import { Job } from 'bullmq'
import { logger } from '@/logger.js'
import type { CollectionItem } from '@/models/consolidated/solr/index.js'
import { SolrNamespaces } from '@/solr.js'
import { ImpressoApplication } from '@/types.js'
import { BulkAddRequest } from '@/internalServices/simpleSolr.js'
import { CollectionIndexVersion } from '@/services/search-facets/search-facets.class.js'

export const JobNameAddItemsToCollection = 'addItemsToCollection'

export interface AddItemsToCollectionJobData {
  userId: string
  collectionId: string
  itemIds: string[]
}

type AddItemsToCollectionJob = Job<AddItemsToCollectionJobData, undefined, typeof JobNameAddItemsToCollection>

/**
 * Resolve the Solr item visibility from the collection access status,
 * mirroring the DB-to-API mapping: anything not `PRI` is treated as public.
 */
export const resolveCollectionVisibility = async (
  app: ImpressoApplication,
  collectionId: string
): Promise<'pub' | 'pri'> => {
  const collectionsService = app.service('collections')
  const collection = await collectionsService.getInternal(collectionId)
  // missing (e.g. deleted) collections fail safe to private
  return collection != null && collection.status !== 'PRI' ? 'pub' : 'pri'
}

const requestToPayload = (
  data: AddItemsToCollectionJobData,
  collectionsIndexVersion: CollectionIndexVersion,
  visibility: 'pub' | 'pri'
): BulkAddRequest<CollectionItem> => {
  const { userId, collectionId, itemIds } = data
  const col_id_s = `${userId}_${collectionId}`

  const items: CollectionItem[] = itemIds.map(ci_id_s => {
    return {
      id: collectionsIndexVersion === 'new' ? `${ci_id_s}!${col_id_s}` : `${col_id_s}|${ci_id_s}`,
      ci_id_s,
      col_id_s,
      vis_s: visibility,
    }
  })

  return {
    add: items,
  }
}

export const createJobHandler = (app: ImpressoApplication) => {
  return async (job: AddItemsToCollectionJob) => {
    logger.info(`➡️ 📚 Processing job ${job.id} ${job.name} to add items to collection: ${JSON.stringify(job.data)} `)
    await addItemsToCollection(app, job.data)
    logger.info(
      `➡️ 📚 Finished processing job ${job.id} ${job.name} to add items to collection: ${JSON.stringify(job.data)} `
    )
    return undefined
  }
}

export const addItemsToCollection = async (app: ImpressoApplication, jobData: AddItemsToCollectionJobData) => {
  const solrClient = app.service('simpleSolrClient')
  const collectionsIndexVersion = app.get('features')?.collectionsIndexVersion ?? 'legacy'
  const visibility = await resolveCollectionVisibility(app, jobData.collectionId)
  await solrClient.sendBulkUpdateRequest(
    SolrNamespaces.CollectionItems,
    requestToPayload(jobData, collectionsIndexVersion, visibility),
    true
  )
}
