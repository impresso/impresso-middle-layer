/* eslint-disable no-unused-vars */
const debug = require('debug')('impresso/services:topics-related');
const { NotFound } = require('@feathersjs/errors');
const { escapeValue } = require('../../util/solr/filterReducers');
const Topic = require('../../models/topics.model');

class TopicsRelated {
  constructor({ name }, app) {
    this.name = name;
  }

  setup(app) {
    this.app = app;
  }

  async get(id, params) {
    debug('[get] query:', params, params.sanitized, params.sanitized.sv);
    const topic = Topic.getCached(id);
    if (!topic.uid.length) {
      throw new NotFound();
    }
    const solrResponse = await this.app.get('solrClient').findAll({
      q: `topics_dpfs:${id} AND (${params.sanitized.sq})`,
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

    const countItems = solrResponse.response.numFound;
    const relatedTopicsParams = {
      limit: params.query.limit,
      offset: params.query.skip,
      total: 0,
      filters: params.sanitized.filters,
      QTime: solrResponse.responseHeader.QTime,
    };

    let relatedTopics = [];
    if (countItems) {
      relatedTopics = solrResponse.facets.topic.buckets.map(d => ({
        uid: d.val,
        w: d.count,
      }));
      relatedTopicsParams.total = solrResponse.facets.topic.numBuckets;
    }
    topic.countItems = countItems;
    topic.relatedTopics = relatedTopics;

    return topic;
  }

  async find(params) {
    // if there's a q, get all suggested topics matching q in their words (they are 300 max)
    const topics = {};
    // fill topics dict with results
    if (params.sanitized.q) {
      const q = escapeValue(params.sanitized.q).split(/\s/).join(' OR ');
      // get uids
      await this.app.get('solrClient').findAll({
        q: `topic_suggest:${q}`,
        highlight_by: 'topic_suggest',
        order_by: params.query.order_by,
        namespace: 'topics',
        limit: 300,
        skip: 0,
      }).then(({ response, fragments }) => {
        response.docs.forEach((d, i) => {
          topics[d.id] = {
            order: i,
            matches: fragments[d.id],
          };
          // add suggest result!
        });
      });
    }

    const uids = Object.keys(topics);
    debug('[find] params.sanitized:', params.sanitized, 'topic uids:', uids);
    console.log(topics);
    const solrResponse = await this.app.get('solrClient').findAllPost({
      q: uids.length ? `topics_dpfs:(${uids.join(' OR ')}) AND (${params.sanitized.sq})` : params.sanitized.sq,
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
        info: {
          QTime: solrResponse.responseHeader.QTime,
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
      },
    };
  }
}

module.exports = function (options) {
  return new TopicsRelated(options);
};

module.exports.TopicsRelated = TopicsRelated;
