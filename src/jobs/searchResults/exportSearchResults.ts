import Attachment from '@/models/attachments.model.js'
import { PublicFindResponse } from '@/models/common.js'
import { Job } from 'bullmq'
import { createHash } from 'crypto'
import { stringify } from 'csv-stringify/sync'
import { accessSync, createReadStream, createWriteStream, constants as fsConstants } from 'fs'
import { access, appendFile, unlink, writeFile } from 'fs/promises'
import { Filter } from 'impresso-jscommons'
import jscommons from 'impresso-jscommons'
import { basename, dirname, join } from 'path'
import { v7 as uuidv7 } from 'uuid'
import { logger } from '@/logger.js'
import { ContentItem as ContentItemPublic } from '@/models/generated/schemasPublic.js'
import DBJob from '@/models/jobs.model.js'
import { SolrNamespace, SolrNamespaces } from '@/solr.js'
import { AppServices, ImpressoApplication } from '@/types.js'
import ZipStream from 'zip-stream'

const { protobuf } = jscommons

type ExportedContentItem = Omit<ContentItemPublic, 'embeddings'>

const ExportedFields = [
  'uid',
  'copyrightStatus',
  'type',
  'sourceMedium',
  'title',
  'transcript',
  'entities',
  'mentions',
  'topics',
  'transcriptLength',
  'totalPages',
  'languageCode',
  'isOnFrontPage',
  'publicationDate',
  'issueUid',
  'countryCode',
  'providerCode',
  'mediaUid',
  'mediaType',
  'hasOLR',
  'ocrQualityScore',
  'relevanceScore',
  'pageNumbers',
  'collectionUids',
] as const satisfies readonly (keyof ExportedContentItem)[]

// Type check to ensure all fields in ContentItemPublic are included in ExportedFields
type MissingKeys = Exclude<keyof ExportedContentItem, (typeof ExportedFields)[number]>
const _ensureComplete: MissingKeys extends never ? true : MissingKeys = true

/**
 * Creates a unique export ID with date prefix, user hash, and UUID.
 * @param userId - The ID of the user creating the export
 * @returns A unique export ID in format: YYYY-MM-DD_<userHash>_<uuid>
 */
const createNewExportId = (userId: string) => {
  const datePrefix = new Date().toISOString().split('T')[0]
  const userIdHash = createHash('sha256').update(String(userId)).digest('hex').slice(0, 8)
  const uuid = uuidv7().replace(/-/g, '')
  return `${datePrefix}_${userIdHash}_${uuid}`
}

/**
 * Publishes a progress update for an export job to the logs service.
 * @param logsService - The logs service instance
 * @param userId - The ID of the user to notify
 * @param exportId - The ID of the export
 * @param progress - The progress percentage (0-100)
 * @param job - The database job record
 * @param isDone - Whether the export is complete (default: false)
 */
const publishProgressUpdate = async (
  logsService: AppServices['logs'],
  userId: string,
  exportId: string,
  progress: number,
  job: DBJob
) => {
  logsService.create({
    tasktype: 'EXP', // Export, see https://github.com/impresso/impresso-frontend/blob/8fc55ff72dd772c5ce3d670afe5e3f3e1fac7512/src/components/modules/lists/JobItem.vue#L162
    taskname: 'Export',
    taskstate: 'PROG',
    progress: progress / 100, // between 0 and 1
    from: 'system',
    to: userId,
    msg: `Export ${exportId} is ${progress}% complete`,
    job: job.toJSON(),
  })
}

const PageSize = 250

export const JobNameExportSearchResults = 'exportSearchResults'

export interface ExportSearchResultsJobData {
  userId: string
  userUid: string // user UID for reporting purposes
  solrNamespace: Extract<SolrNamespace, 'search' | 'tr_passages'>
  filters: Filter[]
  description?: string
  exportContext?: {
    offset: number
    exportId: string
    jobRecordId: number
  }
}

type AddItemsToCollectionJob = Job<ExportSearchResultsJobData, undefined, typeof JobNameExportSearchResults>

/**
 * Gets an existing job record or creates a new one if it doesn't exist.
 * @param JobDbModel - The job database model
 * @param jobRecordId - The ID of an existing job record (optional)
 * @param exportId - The ID of the export
 * @param userId - The ID of the user
 * @returns The job record instance
 */
const getOrCreateJobRecord = async (
  JobDbModel: typeof DBJob,
  jobRecordId: number | undefined,
  exportId: string,
  userId: string,
  filters: Filter[],
  description?: string
) => {
  const existingRecord = jobRecordId != null ? await JobDbModel.findOne({ where: { id: jobRecordId } }) : null
  if (existingRecord) {
    return existingRecord
  }
  const query = protobuf.searchQuery.serialize(
    {
      filters,
    },
    true
  )
  return await JobDbModel.create({
    status: 'RUN',
    type: 'EXP',
    description: description ?? `Export search results job for user ${userId}`,
    creatorId: Number(userId),
    extra: {
      exportId,
      query,
      query_hash: query,
    },
  })
}

/**
 * Validates that the export folder exists and is writable.
 * @param exportFolder - The path to the export folder
 * @throws Error if folder is not configured, doesn't exist, or is not writable
 */
const assertWritableFolder = (exportFolder?: string) => {
  if (!exportFolder) {
    throw new Error('Export folder is not configured. Check the "media.exportFolder" configuration.')
  }
  // Validate that the export folder exists and is writable
  try {
    accessSync(exportFolder, fsConstants.F_OK)
    accessSync(exportFolder, fsConstants.W_OK)
  } catch (error) {
    const errorMessage =
      (error as NodeJS.ErrnoException).code === 'ENOENT'
        ? `Export folder does not exist: ${exportFolder}`
        : `Export folder is not writable: ${exportFolder}`
    throw new Error(errorMessage)
  }
}

/**
 * Appends items as CSV rows to a file, or creates the file with headers if it doesn't exist.
 * @template T - The type of items to append
 * @param filePath - The path to the CSV file
 * @param items - The items to append as CSV rows
 * @param options - Optional configuration (headers: whether to include headers)
 */
export const appendItemsToCSV = async <T extends Record<string, any>>(
  filePath: string,
  headerNames: readonly (keyof T)[],
  items: T[],
  options?: { headers?: boolean }
): Promise<void> => {
  if (items.length === 0) {
    return
  }

  let fileExists = false
  try {
    await access(filePath)
    fileExists = true
  } catch {
    fileExists = false
  }

  const { headers: includeHeaders = !fileExists } = options ?? {}

  const csvContent = stringify(items, {
    header: includeHeaders,
    columns: Array.from(headerNames) as string[],
    quoted: true,
    cast: {
      object: (value: any) => {
        if (value === null) {
          return ''
        }
        return JSON.stringify(value)
      },
    },
  })

  if (fileExists) {
    await appendFile(filePath, csvContent)
  } else {
    await writeFile(filePath, csvContent)
  }
}

/**
 * Constructs the full file path for an export file.
 * @param exportFolder - The export folder path (optional)
 * @param exportId - The export ID
 * @param suffix - The file extension (default: 'csv')
 * @returns The full file path or just the filename if no folder is provided
 */
export const getExportFilePath = (
  exportFolder: string | undefined,
  exportId: string,
  suffix: string = 'csv'
): string => {
  const fileName = `${exportId}.${suffix}`
  return exportFolder == null ? fileName : join(exportFolder, fileName)
}

/**
 * Creates a zip archive of a file with a new name and deletes the original.
 * @param filePath - The path to the file to archive
 * @param newFileName - The name for the new zip file
 * @returns The path to the created zip archive
 * @throws Error if archiving fails
 */
export const createZipArchive = async (filePath: string, newFileName: string): Promise<string> => {
  const folderPath = dirname(filePath)
  const fileName = basename(filePath)
  const zipFilePath = join(folderPath, newFileName)

  const archive = new ZipStream()
  const zipStream = createWriteStream(zipFilePath)

  try {
    return await new Promise<string>((resolve, reject) => {
      archive.on('error', reject)
      zipStream.on('error', reject)

      zipStream.on('finish', async () => {
        try {
          await unlink(filePath)
          resolve(zipFilePath)
        } catch (error) {
          reject(error)
        }
      })

      archive.pipe(zipStream)
      archive.entry(createReadStream(filePath), { name: fileName }, (error: any) => {
        if (error) {
          reject(error)
        } else {
          archive.finish()
        }
      })
    })
  } catch (error) {
    await unlink(zipFilePath).catch(() => {
      // Ignore errors if zip file doesn't exist
    })
    throw error
  }
}

/**
 * Creates a job handler for processing export search results jobs.
 * Fetches search results in batches, writes them to CSV, and creates a zip archive when complete.
 * @param app - The Impresso application instance
 * @returns A job handler function that processes ExportSearchResultsJobData
 * @throws Error if Sequelize client is not initialized or export folder is not configured
 */
export const createJobHandler = (app: ImpressoApplication) => {
  const sequelize = app.get('sequelizeClient')
  if (!sequelize) {
    throw new Error('Sequelize client not initialized in app')
  }

  const exportFolder = app.get('media')?.exportFolder
  assertWritableFolder(exportFolder)

  return async (job: AddItemsToCollectionJob) => {
    logger.info(`😊 Processing job ${job.id} ${job.name} to export search results: ${JSON.stringify(job.data)} `)

    const { filters, solrNamespace, exportContext, userId, userUid, description } = job.data

    if (solrNamespace !== SolrNamespaces.Search) {
      throw new Error(`Export from Solr namespace ${solrNamespace} is not supported yet.`)
    }

    const JobDbModel = DBJob.initialize(sequelize)

    const offset = exportContext?.offset ?? 0
    const exportId = exportContext?.exportId ?? createNewExportId(userId)

    const jobRecord = await getOrCreateJobRecord(
      JobDbModel,
      exportContext?.jobRecordId,
      exportId,
      userId,
      filters,
      description
    )

    // Check if the job has been marked as stopping
    if (jobRecord.status === 'STO') {
      logger.info(`🛑 Job ${job.id} ${job.name} has been marked as stopping. Exiting.`)

      // mark the job as killed and publish final progress update
      await jobRecord.update({ status: 'RIP' })
      await publishProgressUpdate(app.service('logs'), userUid, exportId, 100, jobRecord)

      return
    }

    // fetch the documents from the content-items service
    // Note that we use the "asPublicApi" flag to ensure that the content-items service
    // applies the correct access controls for the user and transforms
    // the data to match the public API schema
    const contentItemsService = app.service('content-items')
    const result = await contentItemsService.find({
      query: {
        filters,
        offset,
        limit: PageSize,
        include_transcript: true,
      },
      asPublicApi: true,
    })
    const {
      data,
      pagination: { total },
    } = result as any as PublicFindResponse<ContentItemPublic>

    // write the documents to the export store
    logger.info(`📝 Writing ${data.length} documents to export ${exportId} for user ${userId} (offset: ${offset})`)

    const exportFilePath = getExportFilePath(exportFolder!, exportId, 'csv')

    await appendItemsToCSV(exportFilePath, [...ExportedFields], data)

    const progressInPercent = Math.min(100, Math.round(((offset + data.length) / total) * 100))
    logger.info(`📊 Job ${job.id} ${job.name} is ${progressInPercent}% complete`)

    // if there are more documents to process, queue another job
    if (offset + data.length < total) {
      const queueService = app.service('queueService')

      logger.info(
        `🔁 Queueing next export job for export ${exportId} for user ${userId} (next offset: ${offset + data.length})`
      )
      await queueService.exportSearchResults({
        userId,
        userUid,
        solrNamespace,
        filters,
        exportContext: {
          offset: offset + data.length,
          exportId,
          jobRecordId: jobRecord.id,
        },
      })
      await publishProgressUpdate(app.service('logs'), userUid, exportId, progressInPercent, jobRecord)
    } else {
      const zipFileName = `${exportId}.zip`
      await createZipArchive(exportFilePath, zipFileName)

      // otherwise, mark the job as done and report
      logger.info(`✅ Export job ${job.id} ${job.name} completed for export ${exportId} for user ${userId}`)

      const AttachmentDbModel = Attachment.initialize(sequelize)
      await jobRecord.update({
        status: 'DON',
      })
      await AttachmentDbModel.create({
        id: jobRecord.id,
        path: zipFileName,
      })
      await publishProgressUpdate(app.service('logs'), userUid, exportId, progressInPercent, jobRecord)
    }
  }
}
