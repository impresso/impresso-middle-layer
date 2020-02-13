const { groupBy, mapValues, first } = require('lodash');
const {
  getTextReusePassagesRequestForArticle,
  convertPassagesSolrResponseToPassages,

  getTextReuseClustersRequestForIds,
  convertClustersSolrResponseToClusters,
} = require('../../logic/textReuse/solr');

function buildResponse(passages, clusters) {
  const clustersById = mapValues(groupBy(clusters, 'id'), first);
  return {
    passages: passages.map(({
      id, clusterId, offsetStart, offsetEnd,
    }) => {
      const { lexicalOverlap, timeCoverage } = clustersById[clusterId];
      return {
	id,
	clusterId,
	lexicalOverlap,
	timeCoverage,
	offsetStart,
	offsetEnd,
      };
    }),
  };
}

class ArticlesTextReusePassages {
  constructor(options, app) {
    this.options = options || {};
    this.solrClient = app.get('solrClient');
  }

  async find(params) {
    const { articleId } = params.route;

    // 1. Get passages and clusters
    const passages = await this.solrClient
      .requestGetRaw(getTextReusePassagesRequestForArticle(articleId), 'tr_passages')
      .then(convertPassagesSolrResponseToPassages);
    const clusterIds = [...new Set(passages.map(({ clusterId }) => clusterId))];
    const clusters = clusterIds.length > 0
      ? await this.solrClient
	.requestGetRaw(getTextReuseClustersRequestForIds(clusterIds), 'tr_clusters')
	.then(convertClustersSolrResponseToClusters)
      : [];

    // 2. Construct response
    const response = buildResponse(passages, clusters);

    return response;
  }
}

module.exports = {
  ArticlesTextReusePassages,
};
