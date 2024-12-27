import Debug from 'debug'
import lodash from 'lodash'
import { preprocessSolrError } from './util/solr/errors'
import { ConnectionPool, initHttpPool, IResponse } from './httpConnectionPool'
import { ImpressoApplication } from './types'

const debug = Debug('impresso/solr')
const debugRequest = Debug('impresso/solr-request')

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
  EntitiesMentions: 'entities_mentions',
})

export const getSolrIndex = (
  namespace: (typeof SolrNamespaces)[keyof typeof SolrNamespaces],
  app: ImpressoApplication
): string | undefined => {
  const solrConfig = app.get('solr')
  const namespaceConfig = solrConfig[namespace] as any
  const namespaceEndpoint: string | undefined = namespaceConfig['endpoint']

  if (namespaceEndpoint == null) return

  const parts = namespaceEndpoint.split('/')
  return parts[parts.length - 2]
}

/**
 * Create headers object out of authentication details.
 */
const buildAuthHeaders = (auth: { user: string; pass: string }): { [key: string]: string } => {
  const authString = `${auth.user}:${auth.pass}`

  return {
    Authorization: `Basic ${Buffer.from(authString).toString('base64')}`,
  }
}

/**
 * Transform Solr response to a JavaScript object.
 * Impresso Solr comes with a plug-in that creates duplicate "highlighting" keys
 * in Solr response. To get around this issue we detect duplicate fields and replace
 * one of them with "fragments".
 */
const transformSolrResponse = (text: string): Record<string, any> => {
  const matches = text.match(/^\s*"highlighting"\s*:\s*\{\s*$/gm)
  const replacedText =
    matches && matches.length > 1 ? text.replace(/^\s*"highlighting"\s*:\s*\{\s*$/m, '"fragments":{') : text

  return JSON.parse(replacedText)
}

/**
 * @param {Response} res response
 * @returns {Promise<Response>}
 */
const checkResponseStatus = async (res: IResponse): Promise<IResponse> => {
  if (res.ok) return res

  const error = new Error(new String(res.statusCode).toString())
  // @ts-ignore
  error.response = {
    statusCode: res.statusCode,
    body: await res.text(),
  }
  throw error
}

/**
 */
function toUrlSearchParameters(queryParmeters: { [key: string]: any } = {}) {
  const preparedQueryParameters = Object.keys(queryParmeters).reduce((acc, key) => {
    if (queryParmeters[key] == null) return acc
    return {
      ...acc,
      [key]: typeof queryParmeters[key] === 'string' ? queryParmeters[key] : JSON.stringify(queryParmeters[key]),
    }
  }, {})

  return new URLSearchParams(preparedQueryParameters)
}

/**
 * Build URL.
 */
function buildUrl(baseUrl: string, queryParams: { [key: string]: any } = {}): string {
  const qp = toUrlSearchParameters(queryParams)
  return `${baseUrl}?${qp.toString()}`
}

/**
 * Check if the request is `GET` and then convert it to a `POST` request
 * using the Solr JSON API rules (https://lucene.apache.org/solr/guide/7_1/json-request-api.html#parameters-mapping).
 *
 * This is here to rectify a problem when a GET request is too large for Solr to process which
 * causes it to return a 431 "request header fields too large" error.
 *
 */
function maybeConvertGetToPostParams(
  url: string,
  requestParams: { [key: string]: any }
): [string, { [key: string]: any }] {
  if (requestParams.method !== 'GET') return [url, requestParams]

  // get rid of possible query string in the URL.
  const u = new URL(url)
  const updatedUrl = [u.origin, u.pathname].join('')

  return [
    updatedUrl,
    {
      ...requestParams,
      method: 'POST',
      qs: undefined, // unset query string
      body: JSON.stringify({
        params: requestParams.qs || {},
      }),
    },
  ]
}

/**
 */
async function executeRequest(url: string, params: object, connectionPool: ConnectionPool) {
  const connection = await connectionPool.acquire()
  if (connectionPool.available === 0) {
    console.warn(`No more available Solr connections out of max ${connectionPool.max}. Next client will be waiting.`)
  }

  try {
    const [u, p] = maybeConvertGetToPostParams(url, params)
    debugRequest(`executeRequest to ${u} with params: ${JSON.stringify(p)} and body: ${p.body}`)
    return await connection
      .fetch(u, p)
      .then(checkResponseStatus)
      .then((response: IResponse) => response.text())
      .then(transformSolrResponse)
      .catch((error: Error) => {
        throw preprocessSolrError(error)
      })
  } finally {
    try {
      await connectionPool.release(connection)
    } catch (e) {
      const error = e as Error
      const message = `
        Could not release Solr connection to the pool: ${error.message}.
        This does not cause an error for the user but should be looked into.
      `
      console.warn(message)
    }
  }
}

/**
 * Send a raw 'POST' request to Solr.
 */
const postRaw = async (
  config: any,
  connectionPool: ConnectionPool,
  payload: any,
  queryParams = {},
  namespace: string = SolrNamespaces.Search
) => {
  const { endpoint } = config[namespace]
  const url = buildUrl(endpoint, queryParams)
  const opts = {
    method: 'POST',
    headers: {
      ...buildAuthHeaders(config.auth),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  }
  return executeRequest(url, opts, connectionPool)
}

/**
 * Send a raw 'POST' request with form payload to Solr.
 */
const postFormRaw = async (
  config: any,
  connectionPool: ConnectionPool,
  payload: any,
  queryParams = {},
  namespace = SolrNamespaces.Search
) => {
  const { endpoint } = config[namespace]
  const url = buildUrl(endpoint, queryParams)
  const body = toUrlSearchParameters(payload)

  const opts = {
    method: 'POST',
    headers: {
      ...buildAuthHeaders(config.auth),
    },
    body,
  }

  return executeRequest(url, opts, connectionPool)
}

/**
 * Send a raw 'GET' request to Solr.
 */
const getRaw = async (
  config: any,
  connectionPool: ConnectionPool,
  params: any,
  namespace: string = SolrNamespaces.Search,
  endpointKey = 'endpoint'
) => {
  const endpoint = config[namespace][endpointKey]
  const url = buildUrl(endpoint, params)

  const options = {
    method: 'GET',
    headers: {
      ...buildAuthHeaders(config.auth),
      'Content-Type': 'application/json',
    },
    qs: params,
  }

  return executeRequest(url, options, connectionPool)
}

const suggest = async (config: any, connectionPool: ConnectionPool, params = {}, factory: any) => {
  const _params = {
    q: '',
    dictionary: 'm_suggester_infix',
    cfq: '', // or 'Person' or 'Location'
    limit: 10,
    offset: 0,
    excerptLength: 30,
    namespace: 'mentions',
    ...params,
  }

  const qs = {
    'suggest.q': _params.q,
    'suggest.cfq': _params.cfq,
    'suggest.dictionary': _params.dictionary,
    start: _params.offset,
    rows: _params.limit,
    wt: 'json',
    // wt: 'xml'
  }

  // suggest?suggest.q=Vic&suggest.dictionary=m_suggester_infix&suggest.cfq=Person
  debug(`suggest: request to '${_params.namespace}' url: `, qs)

  // you can have multiple namespace for the same solr
  // configuration corresponding to  different solr on the same machine.
  return getRaw(config, connectionPool, qs, _params.namespace, 'suggest')
    .then(res => {
      const results = lodash.get(res, `suggest.${qs['suggest.dictionary']}.${qs['suggest.q']}`)

      debug(
        `'suggest' success, ${results.numFound} results in ${res.responseHeader.QTime}ms`,
        factory ? 'with factory' : 'but no factory specified'
      )
      if (!results) {
        return []
      }
      if (factory) {
        results.suggestions = lodash(results.suggestions).take(qs.rows).map(factory()).value()
      }
      return lodash.take(results.suggestions, qs.rows)
    })
    .catch(error => {
      throw preprocessSolrError(error)
    })
}
// TODO: `factory` is not used
const findAllPost = (config: any, connectionsPool: ConnectionPool, params = {}, factory: any) => {
  const qp: Record<string, any> = {
    q: '*:*',
    limit: 10,
    offset: 0,
    excerptLength: 30,
    namespace: 'search',
    requestOriginalPath: '...',
    ...params,
  }

  debug(`[findAllPost][${qp.requestOriginalPath}] request to '${qp.namespace}' endpoint. With PARAMS:`, qp)
  // you can have multiple namespace for the same solr
  // configuration corresponding to  different solr on the same machine.
  const endpoint = `${config[qp.namespace].endpoint}`

  const data: Record<string, any> = {
    q: qp.q,
    start: qp.offset,
    rows: qp.limit,
    wt: 'json',
  }

  if (qp.fq && qp.fq.length) {
    data.fq = qp.fq
  }
  if (qp.highlight_by) {
    data.hl = 'on'
    data['hl.fl'] = qp.highlight_by
    if (qp.highlightProps) {
      Object.assign(data, qp.highlightProps)
    }
  }
  if (qp.vars) {
    Object.assign(data, qp.vars)
  }
  // transform order by if any
  if (qp.order_by) {
    data.sort = qp.order_by
  }

  // transform facets if any
  //
  if (qp.facets) {
    data['json.facet'] = qp.facets
  }

  if (qp.group_by && qp.group_by !== 'id') {
    Object.assign(data, {
      group: true,
      'group.field': qp.group_by,
      // 'group.main': true,
      'group.limit': 3, // top 3
      'group.ngroups': true,
    })
  } else if (qp.collapse_by) {
    // using https://lucene.apache.org/solr/guide/6_6/collapse-and-expand-results.html
    if (!qp.collapse_fn) {
      data.collapse_fn = ''
    }
    if (qp.expand) {
      data.expand = true
    }
    Object.assign(data, {
      fq: `{!collapse field=${qp.collapse_by} ${qp.collapse_fn}}`, // top 1 document matching.
    })
  }

  if (qp.fl) {
    data.fl = Array.isArray(qp.fl) ? qp.fl.join(',') : qp.fl
  }

  debug(
    `[findAllPost][${qp.requestOriginalPath}] request to '${qp.namespace}' endpoint: '${endpoint}'. Using 'data':`,
    data
  )
  return postFormRaw(config, connectionsPool, data, {}, qp.namespace)
    .then(result => {
      if (result.grouped) {
        result.response = {
          numFound: result.grouped[qp.group_by].ngroups,
          docs: result.grouped[qp.group_by].groups,
        }
      }

      debug(
        `[findAllPost][${qp.requestOriginalPath}] success, ${result.response.numFound} results in ${result.responseHeader.QTime}ms`,
        factory ? 'with factory' : '(no factory specified)'
      )

      if (factory) {
        result.response.docs = result.response.docs.map(factory(result))
      }
      return result
    })
    .catch(error => {
      throw preprocessSolrError(error)
    })
}

/**
 * request wrapper to get results from solr.
 * TODO Check grouping: https://lucene.apache.org/solr/guide/6_6/result-grouping.html
 */
const findAll = (config: any, connectionPool: ConnectionPool, params = {}, factory: any = undefined) => {
  const _params: Record<string, any> = {
    q: '*:*',
    limit: 10,
    offset: 0,
    excerptLength: 30,
    namespace: 'search',
    requestOriginalPath: '',
    ...params,
  }

  debug(`[findAll][${_params.requestOriginalPath}]: request to '${_params.namespace}' endpoint. With PARAMS`, _params)

  // you can have multiple namespace for the same solr
  // configuration corresponding to  different solr on the same machine.
  const endpoint = `${config[_params.namespace].endpoint}`

  let qs: Record<string, any> = {
    q: _params.q,

    start: _params.offset,
    rows: _params.limit,
    wt: 'json',
    // wt: 'xml'
  }
  if (_params.fq && _params.fq.length) {
    qs.fq = _params.fq
  }
  if (_params.highlight_by) {
    qs.hl = 'on'
    qs['hl.fl'] = _params.highlight_by
    if (_params.highlightProps) {
      Object.assign(qs, _params.highlightProps)
    }
  }
  if (_params.vars) {
    Object.assign(qs, _params.vars)
  }
  // transform order by if any
  if (_params.order_by) {
    qs.sort = _params.order_by
  }

  // transform facets if any
  //
  if (_params.facets) {
    qs['json.facet'] = _params.facets
  }

  if (_params.group_by && _params.group_by !== 'id') {
    qs = {
      ...qs,
      group: true,
      'group.field': _params.group_by,
      // 'group.main': true,
      'group.limit': 3, // top 3
      'group.ngroups': true,
    }
  } else if (_params.collapse_by) {
    // using https://lucene.apache.org/solr/guide/6_6/collapse-and-expand-results.html
    if (!_params.collapse_fn) {
      _params.collapse_fn = ''
    }
    if (_params.expand) {
      qs.expand = true
    }
    qs = {
      ...qs,
      fq: `{!collapse field=${_params.collapse_by} ${_params.collapse_fn}}`, // top 1 document matching.
    }
  }

  if (_params.fl) {
    qs.fl = Array.isArray(_params.fl) ? _params.fl.join(',') : _params.fl
  } else {
    // default values for fields
  }

  const opts: Record<string, any> = {
    method: 'GET',
    url: endpoint,
    auth: config.auth,
    // qs,
    // form: _params.form,
    // json: true REMOVED because of duplicate keys
  }

  let requestPromise

  if (_params.form) {
    // rewrite query string to get fq and limit the qs params
    opts.form = _params.form
    opts.form.fq = _params.fq
    opts.qs = {
      start: _params.offset,
      rows: _params.limit,
    }
    if (qs['json.facet']) {
      opts.qs['json.facet'] = qs['json.facet']
    }
    // opts.form.q = opts.form.q + ' AND ' +
    opts.method = 'POST'
    requestPromise = postFormRaw(config, connectionPool, opts.form, opts.qs, _params.namespace)
  } else {
    opts.qs = qs
    requestPromise = getRaw(config, connectionPool, qs, _params.namespace)
  }

  debug(
    `[findAll][${_params.requestOriginalPath}]: request to '${_params.namespace}' endpoint. With 'qs':`,
    JSON.stringify(opts.qs)
  )
  debug(`[findAll][${_params.requestOriginalPath}]: url`, endpoint)

  return requestPromise
    .then(result => {
      if (result.grouped) {
        result.response = {
          numFound: result.grouped[_params.group_by].ngroups,
          docs: result.grouped[_params.group_by].groups,
        }
      }

      debug(
        `[findAll][${_params.requestOriginalPath}] success, ${result.response.numFound} results in ${result.responseHeader.QTime}ms`,
        factory ? 'with factory' : 'but no factory specified'
      )

      if (factory) {
        result.response.docs = result.response.docs.map(factory(result))
      }
      return result
    })
    .catch(error => {
      throw preprocessSolrError(error)
    })
}

/**
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
      console.warn(e)
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

/**
 * [resolveAsync description]
 *
 * @param  {Object} config configuration item
 * @param  {Array} groups groups of services, each containing a list of items
 * @param  {Function} factory Instance generator
 * @return {Promise<any>} {uid: instance}
 */
const resolveAsync = async (config: any, connectionsPool: ConnectionPool, groups: Array<any>, factory: Function) => {
  debug(`resolveAsync':  ${groups.length} groups to resolve`)
  await Promise.all(
    groups
      .filter(group => group.items.length > 0)
      .map((group, k) => {
        debug(`resolveAsync': findAll for namespace "${group.namespace}"`)
        const ids = group.items.map((d: any) => d[group.idField || 'uid'])
        return findAll(
          config,
          connectionsPool,
          {
            q: `id:${ids.join(' OR id:')}`,
            fl: group.Klass.SOLR_FL,
            limit: ids.length,
            namespace: group.namespace,
          },
          factory || group.factory || group.Klass.solrFactory
        ).then(res => {
          res.response.docs.forEach((doc: any) => {
            const idx = ids.indexOf(doc.uid)
            groups[k].items[idx][group.itemField || 'item'] = doc
          })
        })
      })
  )
  return groups
}

/**
 * @param {any} config configuration.
 * @param {ConnectionPool} connectionsPool
 */
const getSolrClient = (config: any, connectionsPool: ConnectionPool) => ({
  findAll: (params: any, factory: Function) => findAll(config, connectionsPool, params, factory),
  findAllPost: (params: any, factory: Function) => findAllPost(config, connectionsPool, params, factory),
  suggest: (params: any, factory: Function) => suggest(config, connectionsPool, params, factory),
  requestGetRaw: async (params: any, namespace: string) => getRaw(config, connectionsPool, params, namespace),
  requestPostRaw: async (payload: any, namespace: string) => postRaw(config, connectionsPool, payload, {}, namespace),
  utils: {
    resolveAsync: (items: any, factory: Function) => resolveAsync(config, connectionsPool, items, factory),
  },
})

export default function (app: ImpressoApplication) {
  const untypedApp = app as any
  const config = app.get('solr')

  const poolConfig = {
    ...untypedApp.get('solrConnectionPool'),
    socksProxy: config.socksProxy,
  }
  const connectionPool = initHttpPool(poolConfig)
  untypedApp.set('solrClient', getSolrClient(config, connectionPool))
}

export const client = (solrConfig: any, poolConfig: any) => {
  const connectionPool = initHttpPool(poolConfig)
  return getSolrClient(solrConfig, connectionPool)
}

export const utils = {
  wrapAll,
}
