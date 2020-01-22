const assert = require('assert');
const { get, has } = require('lodash');

const Fields = {
  ContentItemId: 'ci_id_s',
  ClusterId: 'cluster_id_l',
  OffsetStart: 'beg_offset_i',
  OffsetEnd: 'end_offset_i',
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
    q: `${Fields.ContentItemId}:${articleId}`,
    hl: false,
    limit: DefaultPassagesLimit,
  };
}

function convertSolrPassageDocToPassage(doc) {
  const [startOffset, endOffset] = [
    get(doc, Fields.OffsetStart),
    get(doc, Fields.OffsetEnd),
  ];

  return {
    id: get(doc, 'id'),
    clusterId: has(doc, Fields.ClusterId) ? String(get(doc, Fields.ClusterId)) : undefined,
    offsetStart: {
      offset: startOffset,
      regionIndex: 0,
      regionOffset: startOffset,
    },
    offsetEnd: {
      offset: endOffset,
      regionIndex: 0,
      regionOffset: endOffset,
    },
  };
}

function convertPassagesSolrResponseToPassages(solrResponse) {
  return get(solrResponse, 'response.docs', []).map(convertSolrPassageDocToPassage);
}

module.exports = {
  getTextReusePassagesRequestForArticle,
  convertPassagesSolrResponseToPassages,
};
