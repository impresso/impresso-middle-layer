const {
  keyBy, isEmpty,
  assignIn, clone,
  isUndefined, fromPairs,
} = require('lodash');
const Article = require('../../models/articles.model');
const Newspaper = require('../../models/newspapers.model');
const Topic = require('../../models/topics.model');

function getAricleMatchesAndRegions(article, documentsIndex, fragmentsIndex, highlightingIndex) {
  const { uid: id, language } = article;

  const fragments = fragmentsIndex[id][`content_txt_${language}`];
  const highlights = highlightingIndex[id][`content_txt_${language}`];

  const matches = Article.getMatches({
    solrDocument: documentsIndex[id],
    highlights,
    fragments,
  });

  const regions = Article.getRegions({
    regionCoords: documentsIndex[id].pp_plain,
  });

  return [matches, regions];
}

/**
 * Extracts matching documents from Solr response as `Article` items.
 * @param {object} response Solr search response.
 * @param {Service} articlesService service used to fetch articles content by their Ids.
 * @param {object} userInfo - a `{ user, authenticated }` object used to manage
 *                            authorisation of the content.
 *
 * @return {array} a list of `Article` items.
 */
async function getItemsFromSolrResponse(response, articlesService, userInfo = {}) {
  const { user, authenticated } = userInfo;

  const documentsIndex = keyBy(response.response.docs, 'id');
  const uids = Object.keys(documentsIndex);

  if (isEmpty(uids)) return [];

  const {
    fragments: fragmentsIndex,
    highlighting: highlightingIndex,
  } = response;

  const articlesRequest = {
    user,
    authenticated,
    query: {
      limit: uids.length,
      filters: [{ type: 'uid', q: uids }],
    },
  };

  const articles = (await articlesService.find(articlesRequest)).data;

  return articles.map((article) => {
    const [matches, regions] = getAricleMatchesAndRegions(
      article,
      documentsIndex,
      fragmentsIndex,
      highlightingIndex,
    );

    return Article.assignIIIF(assignIn(
      clone(article), { matches, regions },
    ));
  });
}

async function addCachedItems(bucket, provider) {
  if (isUndefined(provider)) return bucket;
  return {
    ...bucket,
    item: await provider.getCached(bucket.val),
    uid: bucket.val,
  };
}

const CacheProvider = {
  newspaper: Newspaper,
  topic: Topic,
};

/**
 * Extract facets from Solr response.
 * @param {object} response Solr response
 * @return {object} facets object.
 */
async function getFacetsFromSolrResponse(response) {
  const { facets = {} } = response;

  const facetPairs = await Promise.all(Object.keys(facets).map(async (facetLabel) => {
    if (!facets[facetLabel].buckets) return [facetLabel, facets[facetLabel]];

    const cacheProvider = CacheProvider[facetLabel];
    const buckets = await Promise.all(
      facets[facetLabel].buckets.map(async b => addCachedItems(b, cacheProvider)),
    );

    return [facetLabel, assignIn(clone(facets[facetLabel]), { buckets })];
  }));

  return fromPairs(facetPairs);
}

/**
 * Extract total number of matched documents.
 * @param {object} response Solr response.
 * @return {number}
 */
function getTotalFromSolrResponse(response) {
  return response.response.numFound;
}

module.exports = {
  getItemsFromSolrResponse,
  getFacetsFromSolrResponse,
  getTotalFromSolrResponse,
};
