const assert = require('assert');
const { get, has } = require('lodash');

const PassageFields = {
  Id: 'id',
  ContentItemId: 'ci_id_s',
  ClusterId: 'cluster_id_l',
  OffsetStart: 'beg_offset_i',
  OffsetEnd: 'end_offset_i',
};

const ClusterFields = {
  Id: 'cluster_id_s',
  LexicalOverlap: 'lex_overlap_d',
  ContentItemsIds: 'member_id_ss',
  TimeDifferenceDay: 'day_delta_f',
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

/**
 * Get Solr query parameters for requesting clusters by their Ids.
 * @param {string[]} clusterIds Ids of clusters
 * @return {object} GET request query parameters
 */
function getTextReuseClustersRequestForIds(clusterIds) {
  assert.ok(Array.isArray(clusterIds) && clusterIds.length > 0, 'At least one cluster Id is required');
  return {
    q: `${ClusterFields.Id}:${clusterIds.join(' OR ')}`,
    hl: false,
    rows: clusterIds.length,
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

const ContentItemIdDateRegex = /^[^-]+-(\d{4}-\d{2}-\d{2})-.*$/;
const extractDateFromContentItemId = (id) => {
  const items = ContentItemIdDateRegex.exec(id);
  if (items && items.length > 1) return new Date(items[1]);
  return undefined;
};
const asDateString = date => date.toISOString().split('T')[0];

function convertSolrClusterToCluster(doc) {
  const ids = get(doc, ClusterFields.ContentItemsIds, []);
  const dates = ids.map(extractDateFromContentItemId).sort((a, b) => a - b);
  const [firstDate] = dates;
  const timeDifferenceMs = get(doc, ClusterFields.TimeDifferenceDay) * 86400000;
  const lastDate = new Date(firstDate.getTime() + timeDifferenceMs);

  return {
    id: get(doc, ClusterFields.Id),
    lexicalOverlap: get(doc, ClusterFields.LexicalOverlap),
    timeCoverage: {
      from: asDateString(firstDate),
      to: asDateString(lastDate),
    },
  };
}

function convertClustersSolrResponseToClusters(solrResponse) {
  return get(solrResponse, 'response.docs', []).map(convertSolrClusterToCluster);
}

module.exports = {
  getTextReusePassagesRequestForArticle,
  convertPassagesSolrResponseToPassages,

  getTextReuseClustersRequestForIds,
  convertClustersSolrResponseToClusters,
};
