/* eslint-disable no-unused-vars */
import lodash from 'lodash'
import { NotFound } from '@feathersjs/errors'
import Timeline from '@/models/timelines.model.js'
import { measureTime } from '@/util/instruments.js'
import { asFindAll } from '@/util/solr/adapters.js'

export class Service {
  constructor({ name = '', app }) {
    this.name = name
    this.app = app
  }

  get solr() {
    return this.app.service('simpleSolrClient')
  }

  async total() {
    const request = {
      q: '*:*',
      limit: 0,
      fl: 'id',
      facets: JSON.stringify({
        year: {
          type: 'terms',
          field: 'meta_year_i',
          mincount: 1,
          limit: 400,
        },
      }),
      namespace: 'search',
    }
    // return measureTime(() => this.solr.findAll(request), 'articles-timelines.solr.total')
    return asFindAll(this.solr, 'search', request)
  }

  async filtered(params) {
    const request = {
      q: params.q || params.query.sq || '*:*',
      limit: 0,
      fl: 'id',
      facets: JSON.stringify({
        year: {
          type: 'terms',
          field: 'meta_year_i',
          mincount: 1,
          limit: 400,
        },
      }),
      namespace: 'search',
    }
    // return measureTime(() => this.solr.findAll(request), 'articles-timelines.solr.filtered')
    return asFindAll(this.solr, 'search', request)
  }

  async stats(params) {
    if (params.query.filters && params.query.filters.length) {
      return Promise.all([this.total(), this.filtered(params)]).then(results => {
        let filteredYearIndex = {}

        if (results[1].facets.year) {
          filteredYearIndex = lodash.keyBy(results[1].facets.year.buckets, 'val')
        }

        return new Timeline({
          name: 'stats',
          legend: {
            w: 'total',
            w1: 'filtered',
          },
          values: results[0].facets.year.buckets.map(bucket => ({
            t: bucket.val,
            w: bucket.count,
            w1: filteredYearIndex[bucket.val] ? filteredYearIndex[bucket.val].count : 0,
          })),
        })
      })
    }
    return this.total().then(
      res =>
        new Timeline({
          name: 'stats',
          legend: {
            w: 'total',
          },
          values: res.facets.year.buckets.map(bucket => ({
            t: bucket.val,
            w: bucket.count,
          })),
        })
    )
  }

  async get(id, params) {
    let result

    if (id === 'stats') {
      result = await this.stats(params)
    }

    if (!result) {
      throw new NotFound()
    }
    return result
  }
}

export default function (options) {
  return new Service(options)
}
