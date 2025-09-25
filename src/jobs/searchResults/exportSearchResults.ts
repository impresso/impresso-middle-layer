import { Job } from 'bullmq'
import { ImpressoApplication } from '../../types'
import { logger } from '../../logger'
import { SolrNamespace } from '../../solr'
import { Filter } from 'impresso-jscommons'

export const JobNameExportSearchResults = 'exportSearchResults'

export interface ExportSearchResultsJobData {
  userId: string
  solrNamespace: Extract<SolrNamespace, 'search' | 'tr_passages'>
  filters: Filter[]
}

type AddItemsToCollectionJob = Job<ExportSearchResultsJobData, undefined, typeof JobNameExportSearchResults>

export const createJobHandler = (app: ImpressoApplication) => {
  return async (job: AddItemsToCollectionJob) => {
    logger.info(`😊 Processing job ${job.id} ${job.name} to export search results: ${JSON.stringify(job.data)} `)
    return undefined
  }
}
