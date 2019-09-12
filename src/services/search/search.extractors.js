const {
  keyBy, isEmpty,
  assignIn, clone,
  isUndefined,
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

async function getFacetsFromSolrResponse(response) {
  const { facets = {} } = response;

  return Promise.all(Object.keys(facets).map(async (facetLabel) => {
    const cacheProvider = CacheProvider[facetLabel];
    const buckets = await Promise.all(
      facets[facetLabel].buckets.map(async b => addCachedItems(b, cacheProvider)),
    );

    return assignIn(clone(facets[facetLabel]), { buckets });
  }));
}

function getTotalFromSolrResponse(response) {
  return response.response.numFound;
}

module.exports = {
  getItemsFromSolrResponse,
  getFacetsFromSolrResponse,
  getTotalFromSolrResponse,
};
