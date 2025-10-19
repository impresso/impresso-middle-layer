import { ImpressoApplication } from '../../../types'
import { ExperimentBase } from './base'

interface RequestBody {
  solrPayload: Record<string, any>
}

interface ResponseBody {
  solrResponse: Record<string, any>
}

export class SubdocEmbeddingsExperiment implements ExperimentBase<RequestBody, ResponseBody> {
  id = 'subdoc-embeddings'
  name = 'Experiment with sentence and character level embeddings'
  description = `
  Generates embeddings for subdocuments using a specified model.
  The body must contain a 'solrPayload' field with a 
  JSON API Solr query (see https://solr.apache.org/guide/solr/latest/query-guide/json-request-api.html).
  `

  async execute(body: RequestBody, app: ImpressoApplication): Promise<ResponseBody> {
    const solrResponse = await app.service('simpleSolrClient').select('subdoc_embeddings_experiment', {
      body: body.solrPayload as any,
    })
    return {
      solrResponse,
    }
  }
}
