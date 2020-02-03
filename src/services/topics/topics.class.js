/* eslint-disable no-unused-vars */
const debug = require('debug')('impresso/services:topics');
const { NotFound } = require('@feathersjs/errors');
const { escapeValue } = require('../../util/solr/filterReducers');
const SequelizeService = require('../sequelize.service');
const SolrService = require('../solr.service');
const Topic = require('../../models/topics.model');

class Service {
  constructor({
    app = null,
    name = '',
  }) {
    this.name = String(name);
    this.app = app;
    // this.sql = SequelizeService({
    //   app,
    //   name,
    // });
    this.solrService = SolrService({
      app,
      name,
      namespace: 'topics',
    });
  }

  async find(params) {
    // if there's a q, get all suggested topics matching q in their words (they are 300 max)
    const topics = {};
    let qtime = 0;
    // fill topics dict with results
    if (params.sanitized.q && params.sanitized.q.length > 2) {
      const q = escapeValue(params.sanitized.q).split(/\s/).join(' OR ');
      const solrSuggestResponse = await this.app.get('solrClient').findAll({
        q: `topic_suggest:${q}`,
        highlight_by: 'topic_suggest',
        order_by: params.query.order_by,
        namespace: 'topics',
        limit: 300,
        skip: 0,
      });
      // set initial query time for suggestions
      qtime = solrSuggestResponse.responseHeader.QTime;

      if (!params.sanitized.filters.length) {
        return {
          total: solrSuggestResponse.response.numFound,
          data: solrSuggestResponse.response.docs.map(d => Topic.getCached(d.id))
            .slice(params.query.skip, params.query.skip + params.query.limit)
            .map((t) => {
              if (solrSuggestResponse.fragments[t.uid].topic_suggest) {
                t.matches = solrSuggestResponse.fragments[t.uid].topic_suggest;
              }
              return t;
            }),
          limit: params.query.limit,
          offset: params.query.skip,
          info: {
            QTime: qtime,
            filters: params.sanitized.filters,
          },
        };
      }
      // otherwise, fill topic index
      solrSuggestResponse.response.docs.forEach((d, i) => {
        console.log(d);
        topics[d.id] = {
          order: i,
          matches: solrSuggestResponse.fragments[d.id],
        };
      });
    }

    const uids = Object.keys(topics);
    const solrQueryParts = [];

    if (uids.length) {
      solrQueryParts.push(`topics_dpfs:(${uids.join(' OR ')})`);
    }
    if (params.sanitized.filters.length) {
      solrQueryParts.push(`(${params.sanitized.sq})`);
    }
    if (!solrQueryParts.length) {
      solrQueryParts.push('*:*');
    }

    debug('[find] params.sanitized:', params.sanitized, 'topic uids:', uids.length, 'solr query parts:', solrQueryParts);

    // console.log(topics);
    const solrResponse = await this.app.get('solrClient').findAllPost({
      q: solrQueryParts.join(' AND '),
      facets: JSON.stringify({
        topic: {
          type: 'terms',
          field: 'topics_dpfs',
          mincount: 1,
          limit: params.query.limit,
          offset: params.query.skip,
          numBuckets: true,
        },
      }),
      limit: 0,
      skip: 0,
      fl: 'id',
      vars: params.sanitized.sv,
    });
    debug('[find] solrResponse:', solrResponse);
    if (!solrResponse.response.numFound || !solrResponse.facets || !solrResponse.facets.topic) {
      return {
        data: [],
        limit: params.query.limit,
        offset: params.query.skip,
        total: 0,
        info: {
          QTime: solrResponse.responseHeader.QTime,
          filters: params.sanitized.filters,
        },
      };
    }

    const data = solrResponse.facets.topic.buckets.map((d) => {
      const topic = Topic.getCached(d.val);
      if (uids.length && topics[d.val]) {
        topic.matches = topics[d.val].matches;
      }
      topic.countItems = d.count;
      return topic;
    });

    return {
      total: solrResponse.facets.topic.numBuckets,
      data,
      limit: params.query.limit,
      offset: params.query.skip,
      info: {
        QTime: solrResponse.responseHeader.QTime,
        filters: params.sanitized.filters,
      },
    };
  }

  async pfind(params) {
    const solrResult = await this.solrService.solr.findAll({
      q: params.sanitized.sq || '*:*',
      highlight_by: params.sanitized.sq ? 'topic_suggest' : false,
      order_by: params.query.order_by,
      namespace: 'topics',
      limit: params.query.limit,
      skip: params.query.skip,
    }, this.solrService.Model.solrFactory);

    debug('\'find\' total topics:', solrResult.response.numFound);

    return {
      total: solrResult.response.numFound,
      limit: params.query.limit,
      skip: params.query.skip,
      data: solrResult.response.docs.map((d) => {
        if (solrResult.fragments[d.uid].topic_suggest) {
          d.matches = solrResult.fragments[d.uid].topic_suggest;
        }
        const cached = this.solrService.Model.getCached(d.uid);
        d.relatedTopics = cached.relatedTopics;
        d.countItems = cached.countItems;
        return d;
      }),
      info: {
        ...params.originalQuery,
      },
    };
  }

  async get(id, params) {
    return this.solrService.get(id, params).then((topic) => {
      const cached = this.solrService.Model.getCached(id);
      topic.countItems = cached.countItems;
      topic.relatedTopics = cached.relatedTopics;
      return topic;
    });
  }

  async create(data, params) {
    if (Array.isArray(data)) {
      return Promise.all(data.map(current => this.create(current, params)));
    }

    return data;
  }

  async update(id, data, params) {
    return data;
  }

  async patch(id, data, params) {
    return data;
  }

  async remove(id, params) {
    return { id };
  }
}

module.exports = function (options) {
  return new Service(options);
};

module.exports.Service = Service;
