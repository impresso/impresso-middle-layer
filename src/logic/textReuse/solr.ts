import { logger } from '../../logger.js'
import assert from 'assert'
import { get, omitBy, isUndefined } from 'lodash-es'
import { SolrMappings } from '../../data/constants.js'
import type { SolrFacetQueryParams, SolrRangeFacetQueryParams, SolrTermsFacetQueryParams } from '../../data/types.js'
import type { Bucket, SelectRequestBody, SelectResponse } from '../../internalServices/simpleSolr.js'
import type { SolrGetRequestQueryParams } from '../../util/solr/adapters.js'

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
} as const

const ClusterFields = {
  Id: 'id',
  LexicalOverlap: 'lex_overlap_d',
  TimeDifferenceDay: 'day_delta_i',
  MinDate: 'min_date_dt',
  MaxDate: 'max_date_dt',
  ClusterSize: 'cluster_size_l',
  ContentItemsIds: 'passages_ss',
} as const

/**
 * We assume there cannot be more than this many passages in an article.
 */
const DefaultPassagesLimit = 100

type SolrDoc = Record<string, any>
type SolrSelectResponse = SelectResponse<SolrDoc, string, Bucket>

export interface Passage {
  id?: string
  clusterId?: string
  articleId?: string
  offsetStart?: number
  offsetEnd?: number
  content?: string
  title?: string
  journalId?: string
  language?: string
  date?: string
  pageNumbers?: number[]
  pageRegions?: number[][]
}

export interface Cluster {
  id?: string
  lexicalOverlap?: number
  clusterSize?: number
  timeCoverage: { from?: string; to?: string }
}

export interface ClusterIdAndTextAndPermission {
  id: string
  text: string
  permissionBitmapExplore?: number
  permissionBitmapGetTranscript?: number
}

export interface FacetResult {
  type: string
  numBuckets: number
  buckets: Bucket[]
}

/**
 * Get Solr query parameters for requesting text passages for an article.
 */
function getTextReusePassagesRequestForArticle(articleId: string, fields?: string[]): SolrGetRequestQueryParams {
  assert.ok(typeof articleId === 'string' && articleId.length > 0, 'Article ID is required')
  const request: SolrGetRequestQueryParams = {
    q: `${PassageFields.ContentItemId}:${articleId}`,
    hl: false,
    rows: DefaultPassagesLimit,
  }
  if (fields) request.fl = fields.join(',')

  return request
}

const DefaultClusterFields: string[] = [
  ClusterFields.Id,
  ClusterFields.LexicalOverlap,
  ClusterFields.MinDate,
  ClusterFields.MaxDate,
  ClusterFields.ClusterSize,
]

const getOneOfFieldsValues = (doc: SolrDoc, fields: readonly string[]): any =>
  fields.reduce((pickedItem, field) => {
    if (pickedItem != null) return pickedItem
    return doc[field]
  }, null)

/**
 * Get Solr query parameters for requesting clusters by their Ids.
 */
function getTextReuseClustersRequestForIds(
  clusterIds: string[],
  fields = DefaultClusterFields
): SolrGetRequestQueryParams {
  assert.ok(Array.isArray(clusterIds) && clusterIds.length > 0, 'At least one cluster Id is required')
  return {
    q: clusterIds.map(clusterId => `${ClusterFields.Id}:${clusterId}`).join(' OR '),
    hl: false,
    rows: clusterIds.length,
    fl: fields.join(','),
  }
}

function parsePageRegions(pageRegionsPlainText: string[] | undefined): number[][] | undefined {
  if (pageRegionsPlainText == null) return undefined
  return pageRegionsPlainText.map(region => region.split(',').map(v => parseInt(v, 10)))
}

function convertSolrPassageDocToPassage(doc: SolrDoc): Passage {
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
  ) as Passage
}

function convertPassagesSolrResponseToPassages(solrResponse: SolrSelectResponse): Passage[] {
  return get(solrResponse, 'response.docs', []).map(convertSolrPassageDocToPassage)
}

const getDateFromISODateString = (date: string): string => date.split('T')[0]

function convertSolrClusterToCluster(doc: SolrDoc): Cluster {
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

function convertClustersSolrResponseToClusters(solrResponse: SolrSelectResponse): Cluster[] {
  return get(solrResponse, 'response.docs', []).map(convertSolrClusterToCluster)
}

const buildContentSearchStatement = (text: string): string =>
  [PassageFields.ContentTextFR, PassageFields.ContentTextDE, PassageFields.ContentTextEN]
    .map(field => `${field}:"${text}"`)
    .join(' OR ')

/**
 * Build a GET request to find cluster IDs of passages that contain `text`.
 */
function getTextReusePassagesClusterIdsSearchRequestForText(
  text: string,
  offset?: number,
  limit?: number,
  orderBy?: string | boolean | null,
  orderByDescending?: boolean
): SolrGetRequestQueryParams {
  const request: SolrGetRequestQueryParams = {
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
 * @return {SolrGetRequestQueryParams & { limit?: number }}
 */
function getLatestTextReusePassageForClusterIdRequest(
  clusterIdOrClusterIds: string | string[]
): SolrGetRequestQueryParams & { limit?: number } {
  const q = Array.isArray(clusterIdOrClusterIds)
    ? clusterIdOrClusterIds.map(id => `${PassageFields.ClusterId}:${id}`).join(' OR ')
    : `${PassageFields.ClusterId}:"${clusterIdOrClusterIds}"`

  const request: SolrGetRequestQueryParams & { limit?: number } = {
    q,
    hl: false,
    limit: Array.isArray(clusterIdOrClusterIds) ? clusterIdOrClusterIds.length : 1,
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

function getClusterIdsTextAndPermissionsFromPassagesSolrResponse(
  solrResponse: SolrSelectResponse
): ClusterIdAndTextAndPermission[] {
  return get(solrResponse, 'response.docs', []).map((doc: SolrDoc) => ({
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

function getPaginationInfoFromPassagesSolrResponse(solrResponse: SolrSelectResponse): {
  limit: number
  offset: number
  total: number
} {
  const json = get(solrResponse, 'responseHeader.params.json')
  if (typeof json === 'string') {
    try {
      const { offset, limit } = JSON.parse(json)
      return {
        limit: typeof limit === 'number' ? limit : 10,
        offset: typeof offset === 'number' ? offset : 0,
        total: get(solrResponse, 'response.numFound') as number,
      }
    } catch (e) {
      logger.warn(e as Error)
      return {
        limit: 10,
        offset: 0,
        total: get(solrResponse, 'response.numFound') as number,
      }
    }
  } else {
    return {
      limit: parseInt(get(solrResponse, 'responseHeader.params.rows', '10'), 10),
      offset: parseInt(get(solrResponse, 'responseHeader.params.start', '0'), 10),
      total: get(solrResponse, 'response.numFound') as number,
    }
  }
}

function getTextReuseClusterPassagesRequest(
  clusterId: string,
  offset?: number,
  limit?: number,
  orderBy?: string | boolean | null,
  orderByDescending?: boolean
): SolrGetRequestQueryParams {
  const request: SolrGetRequestQueryParams = {
    q: `${PassageFields.ClusterId}:"${clusterId}"`,
    hl: false,
  }
  if (offset !== undefined) request.start = offset
  if (limit !== undefined) request.rows = limit
  if (orderBy != null) request.sort = `${orderBy} ${orderByDescending ? 'desc' : 'asc'}`
  return request
}

/**
 * @param {string} from ISO date
 * @param {string} to ISO date
 * @returns {string} either 'year', 'month' or 'day'
 */
function getTimelineResolution(from?: string, to?: string): 'year' | 'month' | 'day' {
  const diffMs = new Date(to as string).getTime() - new Date(from as string).getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)

  if (diffDays <= 31) return 'day'
  if (diffDays <= 365 * 3) return 'month'
  return 'year'
}

const asISOTime = (date: string | undefined, eod?: boolean): string => {
  if (eod) return `${date}T23:59:59Z`
  return `${date}T00:00:00Z`
}

function buildSolrRequestForExtraClusterDetails(
  clusterId: string,
  { from, to }: { from?: string; to?: string } = {}
): SelectRequestBody {
  const timeResolution = getTimelineResolution(from, to)
  let date: SolrFacetQueryParams = { ...(SolrMappings.tr_passages.facets.year as SolrTermsFacetQueryParams) }
  if (timeResolution === 'month') {
    const yearmonthFacet = (SolrMappings.tr_passages.facets as Record<string, SolrFacetQueryParams | undefined>)
      .yearmonth
    date = { ...(yearmonthFacet as SolrTermsFacetQueryParams) }
  }
  if (timeResolution === 'day') {
    // "daterange" is a "range" facet. To speed up the query we constrain it by
    // actual timespan.
    date = {
      ...(SolrMappings.tr_passages.facets.daterange as SolrRangeFacetQueryParams),
      start: asISOTime(from),
      end: asISOTime(to, true),
    }
  }

  return {
    query: `${PassageFields.ClusterId}:${clusterId}`,
    limit: 0,
    facet: {
      mediaSource: { ...(SolrMappings.tr_passages.facets.mediaSource as SolrTermsFacetQueryParams), limit: undefined },
      type: { ...(SolrMappings.tr_passages.facets.type as SolrTermsFacetQueryParams), limit: undefined },
      date,
    },
  }
}

function getFacetsFromExtraClusterDetailsResponse(solrResponse: SolrSelectResponse): FacetResult[] {
  const facetsObject = get(solrResponse, 'facets', {}) as Record<string, { numBuckets?: number; buckets?: Bucket[] }>
  const facetsIds = Object.keys(facetsObject).filter(key => key !== 'count')

  const facets = facetsIds.map(id => {
    const facetObject = facetsObject[id]

    return {
      type: id,
      numBuckets:
        facetObject.numBuckets != null && facetObject.numBuckets >= 0
          ? facetObject.numBuckets
          : (facetObject.buckets ?? []).length,
      buckets: facetObject.buckets ?? [],
    }
  })
  return facets
}

/**
 * @param {string} clusterId cluster ID
 */
function buildConnectedClustersRequest(clusterId: string, limit = 10, offset = 0): SelectRequestBody {
  const request: SelectRequestBody = {
    query: `${PassageFields.ClusterId}:${clusterId}`,
    limit: 0,
    params: { hl: false },
    facet: {
      connectedClusters: {
        ...(SolrMappings.tr_passages.facets.connectedClusters as SolrTermsFacetQueryParams),
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
function parseConnectedClustersResponse(response: SolrSelectResponse): { clustersIds: string[]; total: number } {
  const buckets = get(response, 'facets.connectedClusters.buckets', []) as Bucket[]
  const clustersIds = buckets.map(bucket => bucket.val as string)
  const total = get(response, 'facets.connectedClusters.numBuckets', 0) as number

  return { clustersIds, total }
}

/**
 * @param {string} clusterId cluster ID
 */
function buildConnectedClustersCountRequest(clusterId: string): SelectRequestBody {
  const request: SelectRequestBody = {
    query: `${PassageFields.ClusterId}:${clusterId}`,
    limit: 0,
    params: { hl: false },
    facet: {
      connectedClusters: {
        ...(SolrMappings.tr_passages.facets.connectedClusters as SolrTermsFacetQueryParams),
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
function parseConnectedClustersCountResponse(response: SolrSelectResponse): number {
  return get(response, 'facets.connectedClusters.numBuckets', 0) as number
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
