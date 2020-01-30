const assert = require('assert');
const {
  get, has,
} = require('lodash');

const PassageFields = {
  Id: 'id',
  ContentItemId: 'ci_id_s',
  ClusterId: 'cluster_id_s',
  OffsetStart: 'beg_offset_i',
  OffsetEnd: 'end_offset_i',
  ContentTextFR: 'content_txt_fr',
  Date: 'meta_date_dt',
};

const ClusterFields = {
  Id: 'cluster_id_s',
  LexicalOverlap: 'lex_overlap_d',
  TimeDifferenceDay: 'day_delta_f',
  MinDate: 'min_date_dt',
  MaxDate: 'max_date_dt',
  ClusterSize: 'cluster_size_l',
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
function getTextReusePassagesRequestForArticle(articleId) {
  assert.ok(typeof articleId === 'string' && articleId.length > 0, 'Article ID is required');
  return {
    q: `${PassageFields.ContentItemId}:${articleId}`,
    hl: false,
    rows: DefaultPassagesLimit,
  };
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

function convertSolrPassageDocToPassage(doc) {
  const [offsetStart, offsetEnd] = [
    get(doc, PassageFields.OffsetStart),
    get(doc, PassageFields.OffsetEnd),
  ];

  return {
    id: get(doc, PassageFields.Id),
    clusterId: has(doc, PassageFields.ClusterId)
      ? String(get(doc, PassageFields.ClusterId)) : undefined,
    offsetStart,
    offsetEnd,
  };
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
function getTextReusePassagesClusterIdsSearchRequestForText(text, skip, limit) {
  const request = {
    q: `${PassageFields.ContentTextFR}:"${text}"`,
    hl: false,
    fl: [PassageFields.ClusterId, PassageFields.ContentTextFR].join(','),
    fq: `{!collapse field=${PassageFields.ClusterId} max=ms(${PassageFields.Date})}`,
  };
  if (skip !== undefined) request.start = skip;
  if (limit !== undefined) request.rows = limit;
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

module.exports = {
  getTextReusePassagesRequestForArticle,
  convertPassagesSolrResponseToPassages,

  getTextReuseClustersRequestForIds,
  convertClustersSolrResponseToClusters,

  getTextReusePassagesClusterIdsSearchRequestForText,
  getClusterIdsAndTextFromPassagesSolrResponse,

  DefaultClusterFields,

  getPaginationInfoFromPassagesSolrResponse,
};
