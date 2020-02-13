const assert = require('assert');
const {
  get, chunk, omitBy,
  isUndefined,
} = require('lodash');

const PassageFields = {
  Id: 'id',
  ContentItemId: 'ci_id_s',
  ClusterId: 'cluster_id_s',
  OffsetStart: 'beg_offset_i',
  OffsetEnd: 'end_offset_i',
  ContentTextFR: 'content_txt_fr',
  TitleTextFR: 'title_txt_fr',
  Date: 'meta_date_dt',
  PageNumbers: 'page_nb_is',
  PageRegions: 'page_regions_plain',
  JournalId: 'meta_journal_s',
  ClusterSize: 'cluster_size_l',
};

const ClusterFields = {
  Id: 'cluster_id_s',
  LexicalOverlap: 'lex_overlap_d',
  TimeDifferenceDay: 'day_delta_f',
  MinDate: 'min_date_dt',
  MaxDate: 'max_date_dt',
  ClusterSize: 'cluster_size_l',
  ContentItemsIds: 'member_id_full_ss',
};

/**
 * We assume there cannot be more than this many passages in an article.
 */
const DefaultPassagesLimit = 100;

/**
 * Get Solr query parameters for requesting text passages for an article.
 * @param {string} articleId article ID
 * @return {object} GET request query parameters
 */
function getTextReusePassagesRequestForArticle(articleId, fields = undefined) {
  assert.ok(typeof articleId === 'string' && articleId.length > 0, 'Article ID is required');
  const request = {
    q: `${PassageFields.ContentItemId}:${articleId}`,
    hl: false,
    rows: DefaultPassagesLimit,
  };
  if (fields) request.fl = fields.join(',');

  return request;
}

const DefaultClusterFields = [
  ClusterFields.Id,
  ClusterFields.LexicalOverlap,
  ClusterFields.MinDate,
  ClusterFields.MaxDate,
  ClusterFields.ClusterSize,
];

/**
 * Get Solr query parameters for requesting clusters by their Ids.
 * @param {string[]} clusterIds Ids of clusters
 * @return {object} GET request query parameters
 */
function getTextReuseClustersRequestForIds(clusterIds, fields = DefaultClusterFields) {
  assert.ok(Array.isArray(clusterIds) && clusterIds.length > 0, 'At least one cluster Id is required');
  return {
    q: clusterIds.map(clusterId => `${ClusterFields.Id}:${clusterId}`).join(' OR '),
    hl: false,
    rows: clusterIds.length,
    fl: fields.join(','),
  };
}

function parsePageRegions(pageRegionsPlainText) {
  if (pageRegionsPlainText == null) return undefined;
  return chunk(pageRegionsPlainText.split(',').map(v => parseInt(v, 10)), 4);
}

function convertSolrPassageDocToPassage(doc) {
  const [offsetStart, offsetEnd] = [
    get(doc, PassageFields.OffsetStart),
    get(doc, PassageFields.OffsetEnd),
  ];

  return omitBy({
    id: get(doc, PassageFields.Id),
    clusterId: get(doc, PassageFields.ClusterId),
    articleId: get(doc, PassageFields.ContentItemId),
    offsetStart,
    offsetEnd,
    content: get(doc, PassageFields.ContentTextFR),
    title: get(doc, PassageFields.TitleTextFR),
    journalId: get(doc, PassageFields.JournalId),
    language: 'fr',
    date: get(doc, PassageFields.Date),
    pageNumbers: get(doc, PassageFields.PageNumbers),
    pageRegions: parsePageRegions(get(doc, PassageFields.PageRegions)),
  }, isUndefined);
}

function convertPassagesSolrResponseToPassages(solrResponse) {
  return get(solrResponse, 'response.docs', []).map(convertSolrPassageDocToPassage);
}

const getDateFromISODateString = date => date.split('T')[0];

function convertSolrClusterToCluster(doc) {
  return {
    id: get(doc, ClusterFields.Id),
    lexicalOverlap: get(doc, ClusterFields.LexicalOverlap),
    clusterSize: get(doc, ClusterFields.ClusterSize),
    timeCoverage: {
      from: getDateFromISODateString(get(doc, ClusterFields.MinDate)),
      to: getDateFromISODateString(get(doc, ClusterFields.MaxDate)),
    },
  };
}

function convertClustersSolrResponseToClusters(solrResponse) {
  return get(solrResponse, 'response.docs', []).map(convertSolrClusterToCluster);
}

/**
 * Build a GET request to find cluster IDs of passages that contain `text`.
 * @param {string} text a text snippet
 */
function getTextReusePassagesClusterIdsSearchRequestForText(
  text, skip, limit, orderBy, orderByDescending,
) {
  const request = {
    q: text ? `${PassageFields.ContentTextFR}:"${text}"` : '*:*',
    hl: false,
    fl: [PassageFields.ClusterId, PassageFields.ContentTextFR].join(','),
    fq: `{!collapse field=${PassageFields.ClusterId} max=ms(${PassageFields.Date})}`,
  };
  if (skip !== undefined) request.start = skip;
  if (limit !== undefined) request.rows = limit;
  if (orderBy != null) request.sort = `${orderBy} ${orderByDescending ? 'desc' : 'asc'}`;
  return request;
}

function getLatestTextReusePassageForClusterIdRequest(clusterId) {
  const request = {
    q: `${PassageFields.ClusterId}:"${clusterId}"`,
    hl: false,
    fl: [PassageFields.ClusterId, PassageFields.ContentTextFR].join(','),
    fq: `{!collapse field=${PassageFields.ClusterId} max=ms(${PassageFields.Date})}`,
  };
  return request;
}

function getClusterIdsAndTextFromPassagesSolrResponse(solrResponse) {
  return get(solrResponse, 'response.docs', [])
    .map(doc => ({
      id: doc[PassageFields.ClusterId],
      text: doc[PassageFields.ContentTextFR],
    }));
}

function getPaginationInfoFromPassagesSolrResponse(solrResponse) {
  return {
    limit: parseInt(get(solrResponse, 'responseHeader.params.rows', '10'), 10),
    offset: parseInt(get(solrResponse, 'responseHeader.params.start', '0'), 10),
    total: get(solrResponse, 'response.numFound'),
  };
}

function getTextReuseClusterPassagesRequest(clusterId, skip, limit) {
  const request = {
    q: `${PassageFields.ClusterId}:"${clusterId}"`,
    hl: false,
  };
  if (skip !== undefined) request.start = skip;
  if (limit !== undefined) request.rows = limit;
  return request;
}

module.exports = {
  getTextReusePassagesRequestForArticle,
  convertPassagesSolrResponseToPassages,

  getTextReuseClustersRequestForIds,
  convertClustersSolrResponseToClusters,

  getTextReusePassagesClusterIdsSearchRequestForText,
  getClusterIdsAndTextFromPassagesSolrResponse,

  DefaultClusterFields,

  getPaginationInfoFromPassagesSolrResponse,

  getTextReuseClusterPassagesRequest,

  getLatestTextReusePassageForClusterIdRequest,

  PassageFields,
};
