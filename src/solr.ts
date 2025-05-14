import { FetchOptions, IResponse } from './httpConnectionPool'
import { logger } from './logger'

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

export interface SolrError extends Error {
  response: {
    statusCode: number
    body: string | Record<string, any>
  }
}

export const isSolrError = (error: Error): error is SolrError => {
  const maybeSolrError = error as SolrError
  return (
    maybeSolrError?.response != null &&
    typeof maybeSolrError?.response?.statusCode == 'number' &&
    typeof maybeSolrError?.response?.statusCode == 'string'
  )
}

/**
 * @param {Response} res response
 * @returns {Promise<Response>}
 * @throws {SolrError}
 */
export const checkResponseStatus = async (res: IResponse): Promise<IResponse> => {
  if (res.ok) return res

  const error = new Error(new String(res.statusCode).toString())
  // @ts-ignore
  error.response = {
    statusCode: res.statusCode,
    body: await res.text(),
  }
  throw error
}

const logUnsuccessfulResponses = async (url: string, method: string, body: any, response: IResponse) => {
  if (!response.ok) {
    const errorDetails = {
      method,
      url,
      status: response.statusCode,
      body,
      response: await response.text(),
    }
    const message = `Solr returned an error: ${JSON.stringify(errorDetails, null, 2)}`
    logger.error(message)
  }
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
  onUnsuccessfulResponse: logUnsuccessfulResponses,
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
