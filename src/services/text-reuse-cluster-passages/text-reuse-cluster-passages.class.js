const {
  getTextReuseClusterPassagesRequest,
  getPaginationInfoFromPassagesSolrResponse,
  convertPassagesSolrResponseToPassages,
} = require('../../logic/textReuse/solr');
const { SolrNamespaces } = require('../../solr');

class TextReuseClusterPassages {
  constructor(options = {}, app) {
    this.options = options;
    this.solrClient = app.get('solrClient');
  }

  async find(params) {
    const { clusterId, skip = 0, limit = 10 } = params.query;

    const [passages, info] = await this.solrClient
      .getRaw(
        getTextReuseClusterPassagesRequest(clusterId, skip, limit),
        SolrNamespaces.TextReusePassages,
      )
      .then(response => [
        convertPassagesSolrResponseToPassages(response),
        getPaginationInfoFromPassagesSolrResponse(response),
      ]);

    return { passages, info };
  }
}

module.exports = {
  TextReuseClusterPassages,
};
