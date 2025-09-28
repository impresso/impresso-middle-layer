import { Job } from 'bullmq'
import { ImpressoApplication } from '../../types'
import { logger } from '../../logger'
import { SolrNamespace } from '../../solr'
import { Filter } from 'impresso-jscommons'
import { filtersToQueryAndVariables } from '../../util/solr'

export const JobNameAddQueryResultItemsToCollection = 'addQueryResultItemsToCollection'

export interface AddQueryResultItemsToCollectionJobData {
  userId: string
  collectionId: string
  solrNamespace: Extract<SolrNamespace, 'search' | 'tr_passages'>
  filters: Filter[]
}

type AddQueryResultItemsToCollectionJob = Job<
  AddQueryResultItemsToCollectionJobData,
  undefined,
  typeof JobNameAddQueryResultItemsToCollection
>

const QueryHardLimit = 100000
const PageSize = 1000

export const createJobHandler = (app: ImpressoApplication) => {
  return async (job: AddQueryResultItemsToCollectionJob) => {
    logger.info(
      `🔍 ➡️ 📚 Processing job ${job.id} ${job.name} to add query result items to collection: ${JSON.stringify(job.data)} `
    )

    const { filters, solrNamespace } = job.data

    const { query, filter, params } = filtersToQueryAndVariables(filters, solrNamespace)

    const solrClient = app.service('simpleSolrClient')
    const queueService = app.service('queueService')

    let totalSubjobs = 0
    let offset = 0
    for (let start = 0; start < QueryHardLimit; start += PageSize) {
      const result = await solrClient.select(solrNamespace, {
        body: {
          fields: 'id',
          query,
          filter,
          offset,
          limit: 10000,
          params: {
            hl: false,
            ...params,
          },
        },
      })
      const numFound = result.response?.numFound ?? 0
      if (numFound > QueryHardLimit) {
        logger.error(
          `❌ ➡️ 📚 Aborting job ${job.id} ${job.name} to add query result items to collection: ${JSON.stringify(
            job.data
          )} because the number of matching items (${numFound}) exceeds the hard limit (${QueryHardLimit})`
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
