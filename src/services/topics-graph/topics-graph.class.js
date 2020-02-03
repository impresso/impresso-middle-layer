/* eslint-disable no-unused-vars */
const debug = require('debug')('impresso/services:topics-graph');
const { NotFound } = require('@feathersjs/errors');
const { escapeValue } = require('../../util/solr/filterReducers');
const Topic = require('../../models/topics.model');

const toNode = topic => ({
  id: topic.uid,
  label: topic.getExcerpt().join(' - '),
  countItems: -1,
  degree: 0,
});

class TopicsGraph {
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
    debug('[find] query:', params, params.sanitized, params.sanitized.sv);
    const solrResponse = await this.app.get('solrClient').findAllPost({
      q: params.sanitized.sq,
      facets: JSON.stringify({
        topic: {
          type: 'terms',
          field: 'topics_dpfs',
          mincount: 1,
          limit: 20,
          offset: params.query.skip,
          numBuckets: true,
          facet: {
            topNodes: {
              type: 'terms',
              field: 'topics_dpfs',
              limit: 20,
              numBuckets: true,
            },
          },
        },
      }),
      limit: 0,
      skip: 0,
      fl: 'id',
      vars: params.sanitized.sv,
    });

    const nodes = [];
    const links = [];
    const info = {
      filters: params.sanitized.filters,
      limit: 20,
      offset: params.query.skip,
      QTime: solrResponse.responseHeader.QTime,
    };

    if (!solrResponse.response.numFound || !solrResponse.facets || !solrResponse.facets.topic) {
      return {
        nodes,
        links,
        info,
      };
    }

    const nodesIndex = {};
    const linksIndex = {};
    // return solrResponse;
    solrResponse.facets.topic.buckets.forEach((d) => {
      console.log(d.val, nodesIndex[d.val]);

      if (typeof nodesIndex[d.val] === 'undefined') {
        nodesIndex[d.val] = nodes.length;
        nodes.push({
          ...toNode(Topic.getCached(d.val)),
          countItems: d.count,
        });
        console.log('add', d.val, d.count);
      } else {
        nodes[nodesIndex[d.val]].countItems = d.count;
      }
      // console.log('index', nodesIndex);
      d.topNodes.buckets.forEach((dd) => {
        if (typeof nodesIndex[dd.val] === 'undefined') {
          nodesIndex[dd.val] = nodes.length;
          nodes.push(toNode(Topic.getCached(dd.val)));
        }
        // add link
        if (dd.val !== d.val) {
          const linkId = [nodesIndex[d.val], nodesIndex[dd.val]].sort().join('-');
          if (!linksIndex[linkId]) {
            links.push({
              id: linkId,
              source: nodesIndex[d.val],
              target: nodesIndex[dd.val],
              w: dd.count,
            });
            nodes[nodesIndex[d.val]].degree += 1;
            nodes[nodesIndex[dd.val]].degree += 1;
          }
        }
      });
    });

    return {
      nodes,
      links,
      info,
    };
  }
}

module.exports = function (options) {
  return new TopicsGraph(options);
};

module.exports.TopicsGraph = TopicsGraph;
