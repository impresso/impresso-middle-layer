/* eslint global-require: "off" */
/* eslint import/no-dynamic-require: "off" */
// import { findAllRequestAdapter, findAllResponseAdapter } from '../util/solr/adapters'
const { findAllRequestAdapter, findAllResponseAdapter } = require('../util/solr/adapters')
const lodash = require('lodash')
const debug = require('debug')('impresso/services:SolrService')
// const { areCacheableSolrFields } = require('../util/cache')

/**
 * @deprecated use `SimpleSolrClient`
 */
class SolrService {
  constructor({ name = '', namespace = '', app = null } = {}) {
    this.name = String(name)
    this.namespace = String(namespace)

    /** @type {import('../internalServices/simpleSolr').SimpleSolrClient} */
    this.solr = app.service('simpleSolrClient')

    this.Model = require(`../models/${this.name}.model`)
    debug(`Configuring service: ${this.name} success`)
  }

  /**
   * @deprecated use `SimpleSolrClient`
   */
  async get(id, params) {
    const selectRequest = findAllRequestAdapter({
      q: `id:${id}`,
      limit: 1,
      offset: 0,
      fl: params.fl,
      namespace: this.namespace,
      requestOriginalPath: params.requestOriginalPath,
    })
    const response = await this.solr.select(this.namespace, { body: selectRequest })
    const results = findAllResponseAdapter(response, this.Model.solrFactory)

    // const canBeCached = areCacheableSolrFields(params.fl || [])

    // debug(`get ${id} (${canBeCached ? 'cached' : 'not cached'})`, params)
    // const results = await this.solr.findAll(
    //   {
    //     q: `id:${id}`,
    //     limit: 1,
    //     offset: 0,
    //     fl: params.fl,
    //     namespace: this.namespace,
    //     requestOriginalPath: params.requestOriginalPath,
    //   },
    //   this.Model.solrFactory,
    //   { skipCache: !canBeCached }
    // )
    return lodash.first(results.response.docs)
  }

  /**
   * @deprecated use `SimpleSolrClient`
   */
  async find(params) {
    // const canBeCached = areCacheableSolrFields(params.fl || [])

    // debug(`find (${canBeCached ? 'cached' : 'not cached'})`, params)

    const p = {
      q: params.q || params.query?.sq || '*:*',
      fq: params.fq || params.query.sfq || undefined,
      limit: params.query.limit,
      offset: params.query.offset,
      fl: params.fl,
      facets: params.query.facets,
      order_by: params.query.order_by, // default ordering TODO
      highlight_by: params.query.highlight_by,
      collapse_by: params.collapse_by,
      collapse_fn: params.collapse_fn,
      namespace: this.namespace,
      requestOriginalPath: params.requestOriginalPath,
    }
    // removing unnecessary indefined fields.
    Object.keys(p).forEach(key => p[key] === undefined && delete p[key])

    // const results = await this.solr.findAll(p, this.Model.solrFactory, { skipCache: !canBeCached })
    const selectRequest = findAllRequestAdapter(p)
    const response = await this.solr.select(this.namespace, { body: selectRequest })
    const results = findAllResponseAdapter(response, this.Model.solrFactory)

    return {
      data: results.response.docs,
      total: results.response.numFound,
      limit: p.limit,
      offset: p.offset,
      info: {
        // params,
        responseTime: {
          solr: results.responseHeader.QTime,
        },
        facets: results.facets,
        // solr: results.responseHeader,
      },
    }
  }
}

module.exports = function (options) {
  return new SolrService(options)
}

module.exports.Service = SolrService
