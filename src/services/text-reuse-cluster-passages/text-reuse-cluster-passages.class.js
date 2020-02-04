const {
  getTextReuseClusterPassagesRequest,
  getPaginationInfoFromPassagesSolrResponse,
  convertPassagesSolrResponseToPassages,
} = require('../../logic/textReuse/solr');
const { SolrNamespaces } = require('../../solr');
const Newspaper = require('../../models/newspapers.model');

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
      .then(async response => [
        await Promise.all(convertPassagesSolrResponseToPassages(response)
          .map(async passage => this.addNewspaperMetadata(passage))),
        getPaginationInfoFromPassagesSolrResponse(response),
      ]);

    return { passages, info };
  }

  async addNewspaperMetadata(passage) {
    const newspaper = passage.newspaper
      ? Newspaper.getCached(passage.newspaper.uid)
      : undefined;

    return newspaper !== undefined
      ? { ...passage, newspaper }
      : passage;
  }
}

module.exports = {
  TextReuseClusterPassages,
};
