import { Job } from 'bullmq'
import { ImpressoApplication } from '@/types.js'
import { logger } from '@/logger.js'
import { SolrNamespace } from '@/solr.js'
import { Filter } from 'impresso-jscommons'
import { filtersToQueryAndVariables } from '@/util/solr/index.js'

export const JobNameAddQueryResultItemsToCollection = 'addQueryResultItemsToCollection'

export interface AddQueryResultItemsToCollectionJobData {
  userId: string
  collectionId: string
  solrNamespace: Extract<SolrNamespace, 'search' | 'tr_passages'>
  filters: Filter[]
  queryLimit?: number
}

type AddQueryResultItemsToCollectionJob = Job<
  AddQueryResultItemsToCollectionJobData,
  undefined,
  typeof JobNameAddQueryResultItemsToCollection
>

const DefaultQueryHardLimit = 100000
const PageSize = 1000

export const createJobHandler = (app: ImpressoApplication) => {
  return async (job: AddQueryResultItemsToCollectionJob) => {
    logger.info(
      `🔍 ➡️ 📚 Processing job ${job.id} ${job.name} to add query result items to collection: ${JSON.stringify(job.data)} `
    )

    const { filters, solrNamespace } = job.data

    const { query, filter, params } = filtersToQueryAndVariables(
      filters,
      solrNamespace,
      app.get('solrConfiguration').namespaces ?? []
    )

    const solrClient = app.service('simpleSolrClient')
    const queueService = app.service('queueService')

    const queryLimit = job.data.queryLimit ?? DefaultQueryHardLimit

    let totalSubjobs = 0
    for (let offset = 0; offset < queryLimit; offset += PageSize) {
      const result = await solrClient.select(solrNamespace, {
        body: {
          fields: 'id',
          query,
          filter,
          offset,
          limit: PageSize,
          params: {
            hl: false,
            ...params,
          },
        },
      })
      const numFound = result.response?.numFound ?? 0
      if (numFound > queryLimit) {
        logger.error(
          `❌ ➡️ 📚 Aborting job ${job.id} ${job.name} to add query result items to collection: ${JSON.stringify(
            job.data
          )} because the number of matching items (${numFound}) exceeds the limit (${queryLimit})`
        )
        break
      }
      const docs = result.response?.docs ?? []
      const ids = docs.map(d => d.id) as string[]
      if (ids.length === 0) {
        break
      }

      await queueService.addItemsToCollection({
        userId: job.data.userId,
        collectionId: job.data.collectionId,
        itemIds: ids,
      })
      totalSubjobs++
      offset += ids.length
    }
    logger.info(
      `🔍 ➡️ 📚 Finished processing job ${job.id} ${job.name} to add query result items to collection: ${JSON.stringify(job.data)}. ` +
        `Published ${totalSubjobs} jobs to add all matching items to the collection.`
    )

    return undefined
  }
}
