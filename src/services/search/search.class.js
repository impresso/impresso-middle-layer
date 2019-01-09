/* eslint-disable no-unused-vars */
const lodash = require('lodash');
const debug = require('debug')('impresso/services:search');
const solr = require('../../solr');
const { SOLR_INVERTED_GROUP_BY } = require('../../hooks/search');
const neo4j = require('../../neo4j');
const sequelize = require('../../sequelize');
const sequelizeUtils = require('../../services/sequelize.utils');
const decypher = require('decypher');
const { neo4jRun, neo4jRecordMapper, neo4jSummary } = require('../neo4j.utils');

const article = require('../../models/articles.model');
const Newspaper = require('../../models/newspapers.model');
const Topic = require('../../models/topics.model');

class Service {
  /**
   * Search service. According to group, deliver a different thing.
   *
   * Add solr
   * @param  {object} options pass the current app in options.app
   */
  constructor(options) {
    this.solr = solr.client(options.app.get('solr'));
    this.sequelize = sequelize.client(options.app.get('sequelize'));
    this.neo4j = neo4j.client(options.app.get('neo4j'));
    this.name = options.name;
    this.neo4jQueries = {};
    this.neo4jQueries.articles = decypher(`${__dirname}/../articles/articles.queries.cyp`);
    this.neo4jQueries.pages = decypher(`${__dirname}/../pages/pages.queries.cyp`);

    this.options = options || {};
  }

  static wrap(data, limit, skip, total, info) {
    return {
      data,
      limit,
      skip,
      total,
      info,
    };
  }


  /**
   * async find - generic /search endpoint, this method gets matches from solr
   * and map the results with articles or pages.
   *
   * @param  {object} params query params. Check hhooks
   */
  async find(params) {
    // mapped objects
    let results = [];
    const uids = [];

    debug(`find '${this.name}': query:`, params.query, params.sanitized.sv);


    // TODO: transform params.query.filters to match solr syntax
    const _solr = await this.solr.findAll({
      q: params.query.sq,
      order_by: params.query.order_by,
      facets: params.query.facets,
      limit: params.query.limit,
      skip: params.query.skip,
      fl: article.ARTICLE_SOLR_FL_SEARCH,
      vars: params.sanitized.sv,
    }, article.solrFactory);

    const total = _solr.response.numFound;

    debug(`find '${this.name}': SOLR found ${total} using SOLR params:`, _solr.responseHeader.params);

    if (!total) {
      return Service.wrap([], params.query.limit, params.query.skip, total);
    }

    const groupBy = SOLR_INVERTED_GROUP_BY[params.query.group_by];
    const session = this.neo4j.session();
    const neo4jQueries = this.neo4jQueries[groupBy].findAll;
    const itemsFromNeo4j = await neo4jRun(session, neo4jQueries, {
      _exec_user_uid: params.query._exec_user_uid,
      Project: 'impresso',
      uids: _solr.response.docs.map(d => d.uid),

    }).then((res) => {
      const _records = {};
      debug(`find '${this.name}': neo4j success`, neo4jSummary(res));

      res.records.forEach((rec) => {
        const _rec = neo4jRecordMapper(rec);
        _records[_rec.uid] = _rec;
      });

      return _records;
    }).catch((err) => {
      console.log(err);
      return {};
    });

    const facetGroupsToResolve = [];
    const facets = _solr.facets || {};
    // load from facets
    if (_solr.facets) {
      Object.keys(_solr.facets).forEach((facet) => {
        if (facet === 'newspaper') {
          facetGroupsToResolve.push({
            // the facet key to merge later
            facet,
            engine: 'sequelize',
            service: 'newspapers',
            // enrich bucket with service identifier, uid.
            // SOLR gives it as `val` property of the facet.
            items: _solr.facets.newspaper.buckets.map(d => ({
              ...d,
              count: d.count,
              uid: d.val,
            })),
          });
        } else if(facet === 'topic') {
          facetGroupsToResolve.push({
            // the facet key to merge later
            facet,
            engine: 'solr',
            namespace: 'topics',
            klass: Topic,

            // enrich bucket with service identifier, uid.
            // SOLR gives it as `val` property of the facet.
            items: _solr.facets.topic.buckets.map(d => ({
              ...d,
              count: d.count,
              uid: d.val,
            })),
          });
        }
      });
    }

    if (facetGroupsToResolve.length) {
      // resolve uids with the appropriate service
      const facetGroupsResolved = await Promise.all([
        sequelizeUtils.resolveAsync(this.sequelize,facetGroupsToResolve
          .filter(d => d.engine === 'sequelize')),
        this.solr.utils.resolveAsync(facetGroupsToResolve
          .filter(d => d.engine === 'solr')),
      ]).then(results => results[0].concat(results[1]));

      // add facet resolved item to facet
      facetGroupsResolved.forEach((group) => {
        // rebuild facets!
        debug(`find '${this.name}': rebuilding facet "${group.facet}"`);

        facets[group.facet] = {
          ..._solr.facets[group.facet],
          buckets: group.items,
        }
      });
    }

    // merge results maintaining solr ordering.
    results = _solr.response.docs.map((doc) => {
      let newspaper = doc.newspaper;

      if (facets.newspaper && facets.newspaper.buckets) {
        const facetedNewspaper = facets.newspaper.buckets.find(n => n.uid === newspaper.uid);
        if (facetedNewspaper.item) {
          newspaper = new Newspaper(facetedNewspaper.item);
        }
      }

      return {
        ...doc,
        ...itemsFromNeo4j[doc.uid] || {},
        newspaper,
      };
    });

    return Service.wrap(results, params.query.limit, params.query.skip, total, {
      responseTime: {
        solr: _solr.responseHeader.QTime,
      },
      facets,
    });
  }
}

module.exports = function (options) {
  return new Service(options);
};

module.exports.Service = Service;
