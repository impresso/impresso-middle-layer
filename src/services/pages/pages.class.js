import Page from '../../models/pages.model'

const debug = require('debug')('impresso/services:pages')
const { NotFound } = require('@feathersjs/errors')
const SequelizeService = require('../sequelize.service')
const { measureTime } = require('../../util/instruments')
const { asFindAll } = require('../../util/solr/adapters')

class Service {
  constructor({ app, name }) {
    this.name = name
    this.solr = app.service('simpleSolrClient')
    this.SequelizeService = SequelizeService({
      app,
      name,
    })
  }

  async get(id, params) {
    const request = {
      q: `page_id_ss:${id}`,
      fl: 'id',
      limit: 0,
    }

    const results = await Promise.all([
      // we perform a solr request to get basic info on the page:
      // number of articles,
      // measureTime(() => this.solrClient.findAll(request), 'pages.get.solr.page'),
      asFindAll(this.solr, 'search', request),
      // mysql stuff
      measureTime(
        () =>
          this.SequelizeService.get(id, {}).catch(err => {
            if (err.code === 404) {
              debug(`'get' (WARNING!) no page found using SequelizeService for page id ${id}`)
              return
            }
            throw err
          }),
        'pages.get.db.page'
      ),
    ])

    if (results[0].response.numFound === 0) {
      debug(`get: no articles found for page id ${id}`)
      throw new NotFound()
    }

    if (results[1]) {
      results[1].countArticles = results[0].response.numFound
      return results[1]
    }
    return new Page({
      uid: id,
      countArticles: results[0].response.numFound,
    })
  }

  async find(params) {
    return measureTime(() => this.SequelizeService.find(params), 'pages.find.db.pages')
  }
}

module.exports = function (options) {
  return new Service(options)
}

module.exports.Service = Service
