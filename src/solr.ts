import { logger } from './logger'
import { FetchOptions } from './utils/http/client/base'

export type SolrNamespace =
  | 'search'
  | 'mentions'
  | 'topics'
  | 'entities'
  | 'images'
  | 'tr_passages'
  | 'tr_clusters'
  | 'embeddings_de'
  | 'embeddings_fr'
  | 'embeddings_lb'
  | 'word_embeddings'
  | 'entities_mentions'
  | 'collection_items'
  | 'subdoc_embeddings_experiment'

export const SolrNamespaces = Object.freeze({
  Search: 'search',
  Mentions: 'mentions',
  Topics: 'topics',
  Entities: 'entities',
  Images: 'images',
  TextReusePassages: 'tr_passages',
  TextReuseClusters: 'tr_clusters',
  EmbeddingsDE: 'embeddings_de',
  EmbeddingsFR: 'embeddings_fr',
  EmbeddingsLB: 'embeddings_lb',
  WordEmbeddings: 'word_embeddings',
  EntitiesMentions: 'entities_mentions',
  CollectionItems: 'collection_items',
  SubdocEmbeddingsExperiment: 'subdoc_embeddings_experiment',
}) satisfies Record<string, SolrNamespace>

/**
 * Impresso Solr comes with a plug-in that creates duplicate "highlighting" keys
 * in Solr response. To get around this issue we detect duplicate fields and replace
 * one of them with "fragments".
 */
export const sanitizeSolrResponse = (text: string): string => {
  const matches = text.match(/^\s*"highlighting"\s*:\s*\{\s*$/gm)
  const replacedText =
    matches && matches.length > 1 ? text.replace(/^\s*"highlighting"\s*:\s*\{\s*$/m, '"fragments":{') : text

  return replacedText
}

/**
 * @param {Response} res response
 * @returns {Promise<Response>}
 * @throws {SolrError}
 */
export const checkResponseStatus = async (res: Response): Promise<Response> => {
  if (res.ok) return res

  const error = new Error(new String(res.status).toString())
  // @ts-ignore
  error.response = {
    statusCode: res.status,
    body: await res.text(),
  }
  throw error
}

const defaultRetryOptions: FetchOptions['retryOptions'] = {
  maxRetries: 2,
  maxTimeout: 1000,
  minTimeout: 100,
  timeoutFactor: 3,
  // excluding 500 - it often means the query is not correct
  statusCodes: [502, 503, 504, 429],
}

export const defaultFetchOptions: FetchOptions = {
  retryOptions: defaultRetryOptions,
}

/**
 * @deprecated use `SimpleSolrClient`
 * Return a classic data response for lazy people
 * @param  {[type]} res [description]
 * @return {[type]}     [description]
 */
const wrapAll = (res: Record<string, any>) => {
  let limit = parseInt(res.responseHeader.params.rows, 10)
  let offset = parseInt(res.responseHeader.params.start, 10)
  if (typeof res.responseHeader.params.json === 'string') {
    try {
      const { params } = JSON.parse(res.responseHeader.params.json)
      limit = typeof params.rows === 'number' ? params.rows : limit
      offset = typeof params.start === 'number' ? params.start : offset
    } catch (e) {
      logger.warning(e)
    }
  }
  return {
    data: res.response.docs,
    total: res.response.numFound,
    limit,
    offset,
    info: {
      responseTime: {
        solr: res.responseHeader.QTime,
      },
      facets: res.facets,
    },
  }
}

export const utils = {
  wrapAll,
}
