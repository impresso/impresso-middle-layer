import { optionalMediaSourceToNewspaper } from '../newspapers/newspapers.class'
const {
  getTextReuseClusterPassagesRequest,
  getPaginationInfoFromPassagesSolrResponse,
  convertPassagesSolrResponseToPassages,
  PassageFields,
} = require('../../logic/textReuse/solr')
const sequelize = require('../../sequelize')
const { QueryGetIIIFManifests } = require('../../logic/iiif')
const { toArticlePageDetails } = require('../../logic/ids')
const { parseOrderBy } = require('../../util/queryParameters')
const { measureTime } = require('../../util/instruments')
const { SolrNamespaces } = require('../../solr')
const { getToSelect } = require('../../util/solr/adapters')

const OrderByKeyToField = {
  date: PassageFields.Date,
}

class TextReuseClusterPassages {
  constructor(options = {}, app) {
    this.options = options
    /** @type {import('../../internalServices/simpleSolr').SimpleSolrClient} */
    this.solr = app.service('simpleSolrClient')
    /** @type {import('sequelize') & import('sequelize').Sequelize} */
    this.sequelize = sequelize.client(app.get('sequelize'))
    this.app = app
  }

  async find(params) {
    const { clusterId, offset = 0, limit = 10, orderBy } = params.query

    const [orderByField, orderByDescending] = parseOrderBy(orderBy, OrderByKeyToField)

    const [passages, info] = await this.solr
      .get(
        SolrNamespaces.TextReusePassages,
        getToSelect(getTextReuseClusterPassagesRequest(clusterId, offset, limit, orderByField, orderByDescending))
      )
      .then(response => [
        convertPassagesSolrResponseToPassages(response),
        getPaginationInfoFromPassagesSolrResponse(response),
      ])

    return { passages: await this.asPassageItems(passages, this.app), info }
  }

  async asPassageItems(passages, app) {
    const articleIdToPageId = passages
      .map(({ articleId, pageNumbers }) => toArticlePageDetails(articleId, pageNumbers[0]))
      .reduce((acc, { pageId, articleId }) => {
        acc[articleId] = pageId
        return acc
      }, {})

    const iiifDetails = await this.getIIIFUrlMap(Object.values(articleIdToPageId))
    const pageIdToIIIFUrl = iiifDetails.reduce((acc, { id, iiifUrl }) => {
      acc[id] = iiifUrl
      return acc
    }, {})

    const mediaSourcesLookup = await app.service('media-sources').getLookup()

    return Promise.all(
      passages.map(async passage => {
        const iifUrl = pageIdToIIIFUrl[articleIdToPageId[passage.articleId]]
        return {
          passage,
          newspaper: optionalMediaSourceToNewspaper(mediaSourcesLookup[passage.journalId]),
          iiifUrls: iifUrl != null ? [iifUrl] : [],
        }
      })
    )
  }

  async getIIIFUrlMap(pageIds) {
    if (pageIds.length === 0) return []
    const results = await measureTime(
      () =>
        this.sequelize.query(QueryGetIIIFManifests, {
          replacements: { pageIds },
          type: this.sequelize.QueryTypes.SELECT,
        }),
      'text-reuse-cluster-passages.get.db.iiif'
    )

    return results
  }
}

module.exports = {
  TextReuseClusterPassages,
}
