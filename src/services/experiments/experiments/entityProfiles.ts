import { SolrNamespaces } from '@/solr.js'
import { ImpressoApplication } from '@/types.js'
import { ExperimentBase } from './base.js'

interface RequestBody {
  solrPayload: Record<string, any>
}

interface ResponseBody {
  solrResponse: Record<string, any>
}

export class EntityProfilesExperiment implements ExperimentBase<RequestBody, ResponseBody> {
  id = 'entity-profiles'
  name = 'Experiment with entity profiles and their embeddings'
  description = `
  Generates embeddings for subdocuments using a specified model.
  The body must contain a 'solrPayload' field with a 
  JSON API Solr query (see https://solr.apache.org/guide/solr/latest/query-guide/json-request-api.html).
  `

  async execute(body: RequestBody, app: ImpressoApplication): Promise<ResponseBody> {
    if (body.solrPayload == null) {
      throw new Error("Request body must contain a 'solrPayload' field with a Solr JSON API query.")
    }
    const solrResponse = await app.service('simpleSolrClient').select(SolrNamespaces.EntityProfiles, {
      body: body.solrPayload as any,
    })
    return {
      solrResponse,
    }
  }
}
