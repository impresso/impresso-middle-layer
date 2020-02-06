const {
  getTextReuseClusterPassagesRequest,
  getPaginationInfoFromPassagesSolrResponse,
  convertPassagesSolrResponseToPassages,
} = require('../../logic/textReuse/solr');
const { SolrNamespaces } = require('../../solr');
const Newspaper = require('../../models/newspapers.model');
const sequelize = require('../../sequelize');
const { QueryGetIIIFManifests } = require('../../logic/iiif');
const { toArticlePageDetails } = require('../../logic/ids');

class TextReuseClusterPassages {
  constructor(options = {}, app) {
    this.options = options;
    this.solrClient = app.get('solrClient');
    this.sequelize = sequelize.client(app.get('sequelize'));
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

    return { passages: await this.asPassageItems(passages), info };
  }

  async asPassageItems(passages) {
    const articleIdToPageId = passages
      .map(({ articleId, pageNumbers }) => toArticlePageDetails(articleId, pageNumbers[0]))
      .reduce((acc, { pageId, articleId }) => {
        acc[articleId] = pageId;
        return acc;
      }, {});

    const iiifDetails = await this.getIIIFUrlMap(Object.values(articleIdToPageId));
    const pageIdToIIIFUrl = iiifDetails
      .reduce((acc, { id, iiifUrl }) => {
        acc[id] = iiifUrl;
        return acc;
      }, {});

    return Promise.all(passages.map(async (passage) => {
      const iifUrl = pageIdToIIIFUrl[articleIdToPageId[passage.articleId]];
      return {
        passage,
        newspaper: Newspaper.getCached(passage.journalId),
        iiifUrls: iifUrl != null ? [iifUrl] : [],
      };
    }));
  }

  async getIIIFUrlMap(pageIds) {
    const results = await this.sequelize.query(
      QueryGetIIIFManifests,
      {
        replacements: { pageIds },
        type: this.sequelize.QueryTypes.SELECT,
      },
    );

    return results;
  }
}

module.exports = {
  TextReuseClusterPassages,
};
