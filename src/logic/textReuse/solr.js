const assert = require('assert');
const {
  get, has, mapValues, groupBy,
} = require('lodash');

const PassageFields = {
  Id: 'id',
  ContentItemId: 'ci_id_s',
  ClusterId: 'cluster_id_l',
  OffsetStart: 'beg_offset_i',
  OffsetEnd: 'end_offset_i',
  ContentTextFR: 'content_txt_fr',
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
 * TODO: The request will change once `cluster_id_ls` field is introduced
 * and `collapse` SOLR functionality can be used.
 *
 * Build a GET request to find cluster IDs of passages that contain `text`.
 * @param {string} text a text snippet
 */
function getTextReusePassagesClusterIdsSearchRequestForText(text) {
  return {
    q: `${PassageFields.ContentTextFR}:"${text}"`,
    hl: false,
    fl: [PassageFields.ClusterId, PassageFields.ContentTextFR].join(','),
  };
}

function getClusterIdsFromPassagesSolrResponse(solrResponse) {
  return get(solrResponse, 'response.docs', [])
    .map(doc => doc[PassageFields.ClusterId]);
}

function getTextContentByClusterIdFromPassagesSolrResponse(solrResponse) {
  const items = get(solrResponse, 'response.docs', [])
    .map(doc => ({
      id: doc[PassageFields.ClusterId],
      content: doc[PassageFields.ContentTextFR],
    }));
  return mapValues(groupBy(items, 'id'), v => v[0].content);
}

module.exports = {
  getTextReusePassagesRequestForArticle,
  convertPassagesSolrResponseToPassages,

  getTextReuseClustersRequestForIds,
  convertClustersSolrResponseToClusters,

  getTextReusePassagesClusterIdsSearchRequestForText,
  getClusterIdsFromPassagesSolrResponse,
  getTextContentByClusterIdFromPassagesSolrResponse,

  DefaultClusterFields,
};
