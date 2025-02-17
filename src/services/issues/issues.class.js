const debug = require('debug')('impresso/services:issues')
const { NotFound } = require('@feathersjs/errors')

const SequelizeService = require('../sequelize.service')
const Issue = require('../../models/issues.model')
const Page = require('../../models/pages.model')
const { measureTime } = require('../../util/instruments')
const { asFind } = require('../../util/solr/adapters')

const CoversQuery = `
SELECT id as uid,
  issue_id as issue_uid,
  iiif_manifest as iiif,
  page_number as num,
  has_converted_coordinates as hasCoords,
  has_corrupted_json as hasErrors
FROM pages WHERE id IN (:pageUids)`

class Service {
  constructor({ app, name = '' } = {}) {
    this.name = String(name)
    this.app = app
    this.SequelizeService = SequelizeService({
      app,
      name,
    })
    this.solrFactory = require(`../../models/${this.name}.model`).solrFactory
  }

  get solr() {
    return this.app.service('simpleSolrClient')
  }

  async find(params) {
    debug(`find '${this.name}': with params.isSafe:${params.isSafe} and params.query:`, params.query)
    const request = {
      ...params,
      fl: Issue.ISSUE_SOLR_FL_MINIMAL,
      collapse_by: 'meta_issue_id_s',
      // get first ARTICLE result
      collapse_fn: "sort='page_id_ss ASC'",
    }
    const results = await asFind(this.solr, 'search', request, this.solrFactory)
    // add Sequelize Rawquery to get proper frontPage

    const getCoverIndex = async () => {
      return await measureTime(
        () =>
          this.SequelizeService.rawSelect({
            query: CoversQuery,
            replacements: {
              pageUids: results.data.map(d => d.cover),
            },
          }).then(covers =>
            covers.reduce((index, cover) => {
              index[cover.uid] = new Page(cover)
              return index
            }, {})
          ),
        'issues.find.db.get_pages'
      )
    }

    const coversIndex = (results.data?.length ?? 0) > 0 ? await getCoverIndex() : {}

    results.data = results.data.map(d => {
      if (coversIndex[d.cover]) {
        d.frontPage = coversIndex[d.cover]
      }
      return d
    })
    return results
  }

  // eslint-disable-next-line no-unused-vars
  async get(id, params) {
    const request = {
      query: {
        limit: 1,
        offset: 0,
      },
      q: `meta_issue_id_s:${id}`,
      fl: Issue.ISSUE_SOLR_FL_MINIMAL,
      collapse_by: 'meta_issue_id_s',
      // get first ARTICLE result
      collapse_fn: "sort='id ASC'",
    }

    return Promise.all([
      // we perform a solr request to get
      // the full text, regions of the specified article
      asFind(this.solr, 'search', request, this.solrFactory).then(res => res.data?.[0]),
      measureTime(
        () =>
          this.SequelizeService.rawSelect({
            query: `
          SELECT
            pages.id as uid, pages.iiif_manifest as iiif, pages.page_number as num,
            pages.has_converted_coordinates as hasCoords, COUNT(ci.id) as countArticles,
            issues.access_rights as accessRights
          FROM pages
            JOIN issues
              ON pages.issue_id = issues.id
            LEFT OUTER JOIN page_contentItem as pci
              ON pci.page_id = pages.id
            LEFT OUTER JOIN content_items as ci
              ON pci.content_item_id = ci.id
          WHERE issues.id = :id
          GROUP BY pages.id
          ORDER BY num ASC
        `,
            replacements: {
              id,
            },
          }).then(pages => pages.map(d => new Page(d))),
        'issues.get.db.pages'
      ),
    ]).then(([issue, pages]) => {
      if (!issue) {
        throw new NotFound()
      }
      if (pages.length) {
        // update issue accessRights thanks to pages data loaded from the db
        issue.accessRights = pages[0].accessRights
      }
      issue.pages = pages
      issue.countPages = pages.length
      issue.countArticles = pages.reduce((acc, p) => acc + p.countArticles, 0)
      return issue
    })
  }
}

module.exports = function (options) {
  return new Service(options)
}
module.exports.Service = Service
