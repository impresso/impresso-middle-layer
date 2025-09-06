import { logger } from '../../logger'
import assert from 'assert'
import { get, omitBy, isUndefined } from 'lodash'
import { SolrMappings } from '../../data/constants'

const PassageFields = {
  Id: 'id',
  ContentItemId: 'ci_id_s',
  ClusterId: 'cluster_id_s',
  OffsetStart: 'beg_offset_i',
  OffsetEnd: 'end_offset_i',
  ContentTextFR: 'content_txt_fr',
  ContentTextDE: 'content_txt_de',
  ContentTextEN: 'content_txt_en',
  TitleTextFR: 'title_txt_fr',
  TitleTextDE: 'title_txt_de',
  TitleTextEN: 'title_txt_en',
  Date: 'meta_date_dt',
  PageNumbers: 'page_nb_is',
  PageRegions: 'page_regions_plains',
  JournalId: 'meta_journal_s',
  ClusterSize: 'cluster_size_l',
  ConnectedClusters: 'connected_clusters_ss',

  // Bitmap permissions fields in passage documents.
  PermissionsBitmapExplore: 'rights_bm_explore_l',
  PermissionsBitmapGetTranscript: 'rights_bm_get_tr_l',
}

const ClusterFields = {
  Id: 'id',
  LexicalOverlap: 'lex_overlap_d',
  TimeDifferenceDay: 'day_delta_i',
  MinDate: 'min_date_dt',
  MaxDate: 'max_date_dt',
  ClusterSize: 'cluster_size_l',
  ContentItemsIds: 'passages_ss',
}

/**
 * We assume there cannot be more than this many passages in an article.
 */
const DefaultPassagesLimit = 100

/**
 * Get Solr query parameters for requesting text passages for an article.
 * @param {string} articleId article ID
 * @return {import('../../util/solr/adapters').SolrGetRequestQueryParams}
 */
function getTextReusePassagesRequestForArticle(articleId, fields = undefined) {
  assert.ok(typeof articleId === 'string' && articleId.length > 0, 'Article ID is required')
  const request = {
    q: `${PassageFields.ContentItemId}:${articleId}`,
    hl: false,
    rows: DefaultPassagesLimit,
  }
  if (fields) request.fl = fields.join(',')

  return request
}

const DefaultClusterFields = [
  ClusterFields.Id,
  ClusterFields.LexicalOverlap,
  ClusterFields.MinDate,
  ClusterFields.MaxDate,
  ClusterFields.ClusterSize,
]

const getOneOfFieldsValues = (doc, fields) =>
  fields.reduce((pickedItem, field) => {
    if (pickedItem != null) return pickedItem
    return doc[field]
  }, null)

/**
 * Get Solr query parameters for requesting clusters by their Ids.
 * @param {string[]} clusterIds Ids of clusters
 * @return {import('../../util/solr/adapters').SolrGetRequestQueryParams}
 */
function getTextReuseClustersRequestForIds(clusterIds, fields = DefaultClusterFields) {
  assert.ok(Array.isArray(clusterIds) && clusterIds.length > 0, 'At least one cluster Id is required')
  return {
    q: clusterIds.map(clusterId => `${ClusterFields.Id}:${clusterId}`).join(' OR '),
    hl: false,
    rows: clusterIds.length,
    fl: fields.join(','),
  }
}

function parsePageRegions(pageRegionsPlainText) {
  if (pageRegionsPlainText == null) return undefined
  return pageRegionsPlainText.map(region => region.split(',').map(v => parseInt(v, 10)))
}

function convertSolrPassageDocToPassage(doc) {
  const [offsetStart, offsetEnd] = [get(doc, PassageFields.OffsetStart), get(doc, PassageFields.OffsetEnd)]

  return omitBy(
    {
      id: get(doc, PassageFields.Id),
      clusterId: get(doc, PassageFields.ClusterId),
      articleId: get(doc, PassageFields.ContentItemId),
      offsetStart,
      offsetEnd,
      content: getOneOfFieldsValues(doc, [
        PassageFields.ContentTextFR,
        PassageFields.ContentTextDE,
        PassageFields.ContentTextEN,
      ]),
      title: getOneOfFieldsValues(doc, [
        PassageFields.TitleTextFR,
        PassageFields.TitleTextDE,
        PassageFields.TitleTextEN,
      ]),
      journalId: get(doc, PassageFields.JournalId),
      language: 'fr',
      date: get(doc, PassageFields.Date),
      pageNumbers: get(doc, PassageFields.PageNumbers),
      pageRegions: parsePageRegions(get(doc, PassageFields.PageRegions)),
    },
    isUndefined
  )
}

function convertPassagesSolrResponseToPassages(solrResponse) {
  return get(solrResponse, 'response.docs', []).map(convertSolrPassageDocToPassage)
}

const getDateFromISODateString = date => date.split('T')[0]

function convertSolrClusterToCluster(doc) {
  return {
    id: get(doc, ClusterFields.Id),
    lexicalOverlap: get(doc, ClusterFields.LexicalOverlap),
    clusterSize: get(doc, ClusterFields.ClusterSize),
    timeCoverage: {
      from: getDateFromISODateString(get(doc, ClusterFields.MinDate)),
      to: getDateFromISODateString(get(doc, ClusterFields.MaxDate)),
    },
  }
}

function convertClustersSolrResponseToClusters(solrResponse) {
  return get(solrResponse, 'response.docs', []).map(convertSolrClusterToCluster)
}

const buildContentSearchStatement = text =>
  [PassageFields.ContentTextFR, PassageFields.ContentTextDE, PassageFields.ContentTextEN]
    .map(field => `${field}:"${text}"`)
    .join(' OR ')

/**
 * Build a GET request to find cluster IDs of passages that contain `text`.
 * @param {string} text a text snippet
 * @return {import('../../util/solr/adapters').SolrGetRequestQueryParams}
 */
function getTextReusePassagesClusterIdsSearchRequestForText(text, offset, limit, orderBy, orderByDescending) {
  const request = {
    q: text ? buildContentSearchStatement(text) : '*:*',
    hl: false,
    fl: [
      PassageFields.ClusterId,
      PassageFields.ContentTextFR,
      PassageFields.ContentTextDE,
      PassageFields.ContentTextEN,
    ].join(','),
    fq: `{!collapse field=${PassageFields.ClusterId} max=ms(${PassageFields.Date})}`,
  }
  if (offset !== undefined) request.start = offset
  if (limit !== undefined) request.rows = limit
  if (orderBy != null) request.sort = `${orderBy} ${orderByDescending ? 'desc' : 'asc'}`
  return request
}

/**
 * @return {import('../../util/solr/adapters').SolrGetRequestQueryParams}
 */
function getLatestTextReusePassageForClusterIdRequest(clusterIdOrClusterIds) {
  const clusterId = Array.isArray(clusterIdOrClusterIds) ? undefined : clusterIdOrClusterIds
  const clusterIds = Array.isArray(clusterIdOrClusterIds) ? clusterIdOrClusterIds : undefined

  const q =
    clusterId != null
      ? `${PassageFields.ClusterId}:"${clusterId}"`
      : clusterIds.map(id => `${PassageFields.ClusterId}:${id}`).join(' OR ')

  const request = {
    q,
    hl: false,
    limit: clusterId != null ? 1 : clusterIds.length,
    fl: [
      PassageFields.ClusterId,
      PassageFields.ContentTextFR,
      PassageFields.ContentTextDE,
      PassageFields.ContentTextEN,
    ].join(','),
    fq: `{!collapse field=${PassageFields.ClusterId} max=ms(${PassageFields.Date})}`,
  }
  return request
}

function getClusterIdsTextAndPermissionsFromPassagesSolrResponse(solrResponse) {
  return get(solrResponse, 'response.docs', []).map(doc => ({
    id: doc[PassageFields.ClusterId],
    text: getOneOfFieldsValues(doc, [
      PassageFields.ContentTextFR,
      PassageFields.ContentTextDE,
      PassageFields.ContentTextEN,
    ]),
    permissionBitmapExplore: doc[PassageFields.PermissionsBitmapExplore],
    permissionBitmapGetTranscript: doc[PassageFields.PermissionsBitmapGetTranscript],
  }))
}

function getPaginationInfoFromPassagesSolrResponse(solrResponse) {
  if (typeof get(solrResponse, 'responseHeader.params.json') === 'string') {
    try {
      const { offset, limit } = JSON.parse(solrResponse.responseHeader.params.json)
      return {
        limit: typeof limit === 'number' ? limit : 10,
        offset: typeof offset === 'number' ? offset : 0,
        total: get(solrResponse, 'response.numFound'),
      }
    } catch (e) {
      logger.warning(e)
      return {
        limit: 10,
        offset: 0,
        total: get(solrResponse, 'response.numFound'),
      }
    }
  } else {
    return {
      limit: parseInt(get(solrResponse, 'responseHeader.params.rows', '10'), 10),
      offset: parseInt(get(solrResponse, 'responseHeader.params.start', '0'), 10),
      total: get(solrResponse, 'response.numFound'),
    }
  }
}

/**
 * @return {import('../../util/solr/adapters').SolrGetRequestQueryParams}
 */
function getTextReuseClusterPassagesRequest(clusterId, offset, limit, orderBy, orderByDescending) {
  const request = {
    q: `${PassageFields.ClusterId}:"${clusterId}"`,
    hl: false,
  }
  if (offset !== undefined) request.start = offset
  if (limit !== undefined) request.rows = limit
  if (orderBy != null) request.sort = `${orderBy} ${orderByDescending ? 'desc' : 'asc'}`
  return request
}

/**
 *
 * @param {string} from ISO date
 * @param {string} to ISO date
 * @returns {string} either 'year', 'month' or 'day'
 */
function getTimelineResolution(from, to) {
  const diffMs = new Date(to).getTime() - new Date(from).getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)

  if (diffDays <= 31) return 'day'
  if (diffDays <= 365 * 3) return 'month'
  return 'year'
}

const asISOTime = (date, eod) => {
  if (eod) return `${date}T23:59:59Z`
  return `${date}T00:00:00Z`
}

/**
 * @param {string} clusterId
 * @param {{ from: string, to: string }} timeSpan
 */
function buildSolrRequestForExtraClusterDetails(clusterId, { from, to } = {}) {
  const timeResolution = getTimelineResolution(from, to)
  let date = { ...SolrMappings.tr_passages.facets.year }
  if (timeResolution === 'month') date = { ...SolrMappings.tr_passages.facets.yearmonth }
  if (timeResolution === 'day') {
    // "daterange" is a "range" facet. To speed up the query we constrain it by
    // actual timespan.
    date = {
      ...SolrMappings.tr_passages.facets.daterange,
      start: asISOTime(from),
      end: asISOTime(to, true),
    }
  }

  return {
    query: `${PassageFields.ClusterId}:${clusterId}`,
    limit: 0,
    facet: {
      newspaper: { ...SolrMappings.tr_passages.facets.newspaper, limit: undefined },
      type: { ...SolrMappings.tr_passages.facets.type, limit: undefined },
      date,
    },
  }
}

function getFacetsFromExtraClusterDetailsResponse(solrResponse) {
  const facetsObject = get(solrResponse, 'facets', {})
  const facetsIds = Object.keys(facetsObject).filter(key => key !== 'count')

  const facets = facetsIds.map(id => {
    const facetObject = facetsObject[id]

    return {
      type: id,
      numBuckets: facetObject.numBuckets >= 0 ? facetObject.numBuckets : facetObject.buckets.length,
      buckets: facetObject.buckets,
    }
  })
  return facets
}

/**
 * @param {string} clusterId cluster ID
 * @param {number} limit
 * @param {number} offset
 * @return {import('../../internalServices/simpleSolr').SelectRequestBody}
 */
function buildConnectedClustersRequest(clusterId, limit = 10, offset = 0) {
  const request = {
    query: `${PassageFields.ClusterId}:${clusterId}`,
    limit: 0,
    params: { hl: false },
    facet: {
      connectedClusters: {
        ...SolrMappings.tr_passages.facets.connectedClusters,
        limit,
        offset,
      },
    },
  }
  return request
}

/**
 * @param {Record<string, any>} response
 * @returns {{ clustersIds: string[], total: number }}
 */
function parseConnectedClustersResponse(response) {
  const buckets = get(response, 'facets.connectedClusters.buckets', [])
  const clustersIds = buckets.map(bucket => bucket.val)
  const total = get(response, 'facets.connectedClusters.numBuckets', 0)

  return { clustersIds, total }
}

/**
 * @param {string} clusterId cluster ID
 * @return {import('../../internalServices/simpleSolr').SelectRequestBody}
 */
function buildConnectedClustersCountRequest(clusterId) {
  const request = {
    query: `${PassageFields.ClusterId}:${clusterId}`,
    limit: 0,
    params: { hl: false },
    facet: {
      connectedClusters: {
        ...SolrMappings.tr_passages.facets.connectedClusters,
        limit: 0,
        offset: 0,
      },
    },
  }
  return request
}

/**
 * @param {Record<string, any>} response
 * @returns {number}
 */
function parseConnectedClustersCountResponse(response) {
  return get(response, 'facets.connectedClusters.numBuckets', 0)
}

export {
  getTextReusePassagesRequestForArticle,
  convertPassagesSolrResponseToPassages,

  getTextReuseClustersRequestForIds,
  convertClustersSolrResponseToClusters,

  getTextReusePassagesClusterIdsSearchRequestForText,
  getClusterIdsTextAndPermissionsFromPassagesSolrResponse,

  DefaultClusterFields,

  getPaginationInfoFromPassagesSolrResponse,

  getTextReuseClusterPassagesRequest,

  getLatestTextReusePassageForClusterIdRequest,

  PassageFields,

  buildSolrRequestForExtraClusterDetails,
  getFacetsFromExtraClusterDetailsResponse,
  getTimelineResolution,

  buildConnectedClustersRequest,
  parseConnectedClustersResponse,

  buildConnectedClustersCountRequest,
  parseConnectedClustersCountResponse,
}
