/* eslint-disable no-unused-vars */
const lodash = require('lodash');
const { NotFound } = require('@feathersjs/errors');
const Timeline = require('../../models/timelines.model');
const { measureTime } = require('../../util/instruments');

class Service {
  constructor({
    name = '',
    app,
  }) {
    this.name = name;
    this.app = app;
    this.solr = this.app.get('solrClient');
  }

  async total() {
    return measureTime(() => this.solr.findAll({
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
    }), 'articles-timelines.solr.total');
  }

  async filtered(params) {
    return measureTime(() => this.solr.findAll({
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
    }), 'articles-timelines.solr.filtered');
  }

  async stats(params) {
    if (params.query.filters && params.query.filters.length) {
      return Promise.all([
        this.total(),
        this.filtered(params),
      ]).then((results) => {
        let filteredYearIndex = {};

        if (results[1].facets.year) {
          filteredYearIndex = lodash.keyBy(results[1].facets.year.buckets, 'val');
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
        });
      });
    }
    return this.total().then(res => new Timeline({
      name: 'stats',
      legend: {
        w: 'total',
      },
      values: res.facets.year.buckets.map(bucket => ({
        t: bucket.val,
        w: bucket.count,
      })),
    }));
  }

  async get(id, params) {
    let result;

    if (id === 'stats') {
      result = await this.stats(params);
    }

    if (!result) {
      throw new NotFound();
    }
    return result;
  }
}

module.exports = function (options) {
  return new Service(options);
};

module.exports.Service = Service;
