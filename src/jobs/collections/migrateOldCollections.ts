import { Job } from 'bullmq'
import { ImpressoApplication } from '../../types'
import { logger } from '../../logger'
import { SolrNamespaces } from '../../solr'

export const JobNameMigrateOldCollections = 'migrateOldCollections'

export interface MigrateOldCollectionsJobData {}

type MigrateOldCollectionsJob = Job<MigrateOldCollectionsJobData, undefined, typeof JobNameMigrateOldCollections>

export const createJobHandler = (app: ImpressoApplication) => {
  return async (job: MigrateOldCollectionsJob) => {
    logger.info(`🔄 📚 Processing job ${job.id} ${job.name} to migrate old collections: ${JSON.stringify(job.data)} `)

    await migrateOldCollections(app)

    logger.info(
      `✅ 📚 Finished processing job ${job.id} ${job.name} to migrate old collections: ${JSON.stringify(job.data)} `
    )

    return undefined
  }
}

const migrateOldCollections = async (app: ImpressoApplication) => {
  const solrClient = app.service('simpleSolrClient')

  const response = await solrClient.select<unknown, 'collection'>(SolrNamespaces.Search, {
    body: {
      query: 'ucoll_ss:*',
      limit: 0,
      facet: {
        collection: {
          type: 'terms',
          field: 'ucoll_ss',
          limit: -1,
          mincount: 1,
        },
      },
    },
  })
  const collectionIdWithCountItems: [string, number][] =
    response.facets?.collection.buckets.map(bucket => {
      const collectionId = bucket.val as string
      return [collectionId, bucket.count ?? 0]
    }) ?? []

  const collectionsService = app.service('collections')
  const queueService = app.service('queueService')

  for (const [collectionId, countItems] of collectionIdWithCountItems) {
    const collection = await collectionsService.getInternal(collectionId)
    if (collection && collection.creatorId) {
      // collectionOwnerIdLookup.set(collectionId, String(collection.creatorId))
      logger.info(`Collection ${collectionId} (owner: ${collection.creatorId}) has ${countItems} items`)
      if (countItems > 2) {
        // Migrate items in batches of 10,000
        const pageSize = 1000
        for (let offset = 0; offset < countItems; offset += pageSize) {
          const response = await solrClient.select<{ id: string }>(SolrNamespaces.Search, {
            body: {
              query: `ucoll_ss:${collectionId}`,
              limit: pageSize,
              offset,
              params: {
                hl: false,
              },
            },
          })
          const itemIds: string[] = response.response?.docs.map(doc => doc.id) ?? []
          queueService.addItemsToCollection({
            userId: String(collection.creatorId),
            collectionId,
            itemIds,
          })
          logger.info(
            `Queued adding ${itemIds.length} items to collection ${collectionId} for user ${collection.creatorId}`
          )
        }
        logger.info(`Collection ${collectionId} migration completed`)
      } else {
        logger.info(`Collection ${collectionId} has ${countItems} items, skipping migration`)
      }
    } else {
      logger.warn(`Collection ${collectionId} has no owner (creatorId is null or collection does not exist)`)
    }
  }

  // const collectionOwnerIdLookup = new Map<string, string>()
}
