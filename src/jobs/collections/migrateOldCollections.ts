import { Job } from 'bullmq'
import { ImpressoApplication } from '@/types.js'
import { logger } from '@/logger.js'
import { SolrNamespaces } from '@/solr.js'
import { addItemsToCollection } from './addItemsToCollection.js'

export const JobNameMigrateOldCollections = 'migrateOldCollections'

export interface MigrateOldCollectionsJobData {
  collection?: {
    collectionId: string
    userId: string
    offset: number
    limit: number
  }
}

type MigrateOldCollectionsJob = Job<MigrateOldCollectionsJobData, undefined, typeof JobNameMigrateOldCollections>

export const createJobHandler = (app: ImpressoApplication) => {
  return async (job: MigrateOldCollectionsJob) => {
    logger.info(`🔄 📚 Processing job ${job.id} ${job.name} to migrate old collections: ${JSON.stringify(job.data)} `)

    await migrateOldCollections(app, job.data)

    logger.info(
      `✅ 📚 Finished processing job ${job.id} ${job.name} to migrate old collections: ${JSON.stringify(job.data)} `
    )

    return undefined
  }
}

const migrateOldCollections = async (app: ImpressoApplication, data: MigrateOldCollectionsJobData) => {
  const solrClient = app.service('simpleSolrClient')
  const collectionsService = app.service('collections')
  const queueService = app.service('queueService')

  if (data.collection) {
    /**
     * Add a batch
     */
    const response = await solrClient.select<{ id: string }>(SolrNamespaces.Search, {
      body: {
        query: `ucoll_ss:${data.collection.collectionId}`,
        limit: data.collection.limit,
        offset: data.collection.offset,
        params: {
          hl: false,
        },
      },
    })
    const itemIds: string[] = response.response?.docs.map(doc => doc.id) ?? []
    await addItemsToCollection(app, {
      userId: String(data.collection.userId),
      collectionId: data.collection.collectionId,
      itemIds,
    })
    logger.info(
      `Added ${itemIds.length} items to collection ${data.collection.collectionId} for user ${data.collection.userId}`
    )
  } else {
    /**
     * start the process
     */
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

    for (const [collectionId, countItems] of collectionIdWithCountItems) {
      const collection = await collectionsService.getInternal(collectionId)
      if (collection && collection.creatorId) {
        // collectionOwnerIdLookup.set(collectionId, String(collection.creatorId))
        logger.info(`Collection ${collectionId} (owner: ${collection.creatorId}) has ${countItems} items`)
        if (countItems > 2) {
          // Migrate items in batches of 1000
          const pageSize = 1000

          for (let offset = 0; offset < countItems; offset += pageSize) {
            queueService.migrateOldCollections({
              collection: {
                collectionId,
                userId: String(collection.creatorId),
                offset,
                limit: pageSize,
              },
            })
          }
          logger.info(`Collection ${collectionId} migration queued in ${Math.ceil(countItems / pageSize)} batches`)
        } else {
          logger.info(`Collection ${collectionId} has ${countItems} items, skipping migration`)
        }
      } else {
        logger.warn(`Collection ${collectionId} has no owner (creatorId is null or collection does not exist)`)
      }
    }
  }
}
