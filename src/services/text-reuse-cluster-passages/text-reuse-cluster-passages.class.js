// @ts-check
const {
  getTextReuseClusterPassagesRequest,
  getPaginationInfoFromPassagesSolrResponse,
  convertPassagesSolrResponseToPassages,
  PassageFields,
} = require('../../logic/textReuse/solr');
const Newspaper = require('../../models/newspapers.model');
const sequelize = require('../../sequelize');
const { QueryGetIIIFManifests } = require('../../logic/iiif');
const { toArticlePageDetails } = require('../../logic/ids');
const { parseOrderBy } = require('../../util/queryParameters');
const { measureTime } = require('../../util/instruments');

const OrderByKeyToField = {
  date: PassageFields.Date,
};

class TextReuseClusterPassages {
  constructor (options = {}, app) {
    this.options = options;
    /** @type {import('../../cachedSolr').CachedSolrClient} */
    this.solr = app.get('cachedSolr');
    /** @type {import('sequelize') & import('sequelize').Sequelize} */
    this.sequelize = sequelize.client(app.get('sequelize'));
  }

  async find (params) {
    const {
      clusterId,
      skip = 0,
      limit = 10,
      orderBy,
    } = params.query;

    const [orderByField, orderByDescending] = parseOrderBy(orderBy, OrderByKeyToField);

    const [passages, info] = await this.solr
      .get(
        getTextReuseClusterPassagesRequest(clusterId, skip, limit, orderByField, orderByDescending),
        this.solr.namespaces.TextReusePassages,
      )
      .then(response => [
        convertPassagesSolrResponseToPassages(response),
        getPaginationInfoFromPassagesSolrResponse(response),
      ]);

    return { passages: await this.asPassageItems(passages), info };
  }

  async asPassageItems (passages) {
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

  async getIIIFUrlMap (pageIds) {
    if (pageIds.length === 0) return [];
    const results = await measureTime(() => this.sequelize.query(
      QueryGetIIIFManifests,
      {
        replacements: { pageIds },
        type: this.sequelize.QueryTypes.SELECT,
      },
    ), 'text-reuse-cluster-passages.get.db.iiif');

    return results;
  }
}

module.exports = {
  TextReuseClusterPassages,
};
