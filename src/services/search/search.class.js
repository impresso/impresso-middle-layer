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
const { NotFound, NotImplemented } = require('@feathersjs/errors');

const Article = require('../../models/articles.model');
const Newspaper = require('../../models/newspapers.model');
const Topic = require('../../models/topics.model');
const CollectableItem = require('../../models/collectable-items.model');


class Service {
  /**
   * Search service. According to group, deliver a different thing.
   *
   * Add solr
   * @param  {object} options pass the current app in app
   */
  constructor({
    app,
    name,
  } = {}) {
    this.app = app;
    this.solr = solr.client(app.get('solr'));
    this.sequelize = sequelize.client(app.get('sequelize'));
    this.neo4j = neo4j.client(app.get('neo4j'));
    this.name = name;
    this.neo4jQueries = {};
    this.neo4jQueries.articles = decypher(`${__dirname}/../articles/articles.queries.cyp`);
    this.neo4jQueries.pages = decypher(`${__dirname}/../pages/pages.queries.cyp`);
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
   * Save current search and return the corrseponding searchQuery
   * @param  {[type]}  data   [description]
   * @param  {[type]}  params [description]
   * @return {Promise}        [description]
   */
  async create(data, params) {
    const client = this.app.get('celeryClient');
    if (!client) {
      return {};
    }

    const q = params.sanitized.sq;
    const fq = params.sanitized.sfq;
    debug(`create '${this.name}', from solr query: ${q}`);

    return client.run({
      task: 'impresso.tasks.add_to_collection_from_query',
      args: [
        // collection_uid
        params.sanitized.collection_uid,
        // user id
        params.user.id,
        // query
        q,
        // filter query
        fq,
        // content_type, A for article
        'A',
      ],
    }).catch((err) => {
      if (err.result.exc_type === 'DoesNotExist') {
        throw new NotFound(err.result.exc_message);
      } else if (err.result.exc_type === 'OperationalError') {
        // probably db is not availabe
        throw new NotImplemented();
      }
      throw new NotImplemented();
    });
  }

  /**
   * async find - generic /search endpoint, this method gets matches from solr
   * and map the results with articles or pages.
   *
   * @param  {object} params query params. Check hhooks
   */
  async find(params) {
    debug(`find '${this.name}': query:`, params.query, params.sanitized.sv);

    // TODO: transform params.query.filters to match solr syntax
    const _solr = await this.solr.findAll({
      q: params.query.sq,
      fq: params.sanitized.sfq,
      order_by: params.query.order_by,
      facets: params.query.facets,
      limit: params.query.limit,
      skip: params.query.skip,
      fl: 'id,pp_plain:[json]', // for articles.
      vars: params.sanitized.sv,
    });

    const total = _solr.response.numFound;

    debug(`find '${this.name}': SOLR found ${total} using SOLR params:`, _solr.responseHeader.params);

    if (!total) {
      return Service.wrap([], params.query.limit, params.query.skip, total);
    }

    // remap for the addons...
    const uids = _solr.response.docs.map(d => d.id);
    // get text matches
    // const fragments = res.fragments[art.uid][`content_txt_${art.language}`];
    // const highlights = res.highlighting[art.uid][`content_txt_${art.language}`];
    debug(
      `find '${this.name}': call articles service for ${uids.length} uids, user:`,
      params.user ? params.user.uid : 'no auth user found',
    );

    // get articles (if group by is article ...)!
    const results = await this.app.service('articles').find({
      user: params.user,
      authenticated: params.authenticated,
      query: {
        limit: 20,
        filters: [
          {
            type: 'uid',
            q: uids,
          },
        ],
      },
    })
    .then(res => res.data)
    .then(articles => articles.map((article) => {
      // complete article with fragments found
      const fragments = _solr.fragments[article.uid][`content_txt_${article.language}`];
      const highlights = _solr.highlighting[article.uid][`content_txt_${article.language}`];
      article.matches = Article.getMatches({
        solrDocument: _solr.response.docs.find(doc => doc.id === article.uid),
        highlights,
        fragments,
      });
      return article;
    }));

    // resolve facets...
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
        } else if (facet === 'topic') {
          facetGroupsToResolve.push({
            // the facet key to merge later
            facet,
            engine: 'solr',
            namespace: 'topics',
            Klass: Topic,
            factory: Topic.solrFacetFactory,
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
        sequelizeUtils.resolveAsync(this.sequelize, facetGroupsToResolve
          .filter(d => d.engine === 'sequelize')),
        this.solr.utils.resolveAsync(facetGroupsToResolve
          .filter(d => d.engine === 'solr')),
      ]).then(groups => groups[0].concat(groups[1]));

      // add facet resolved item to facet
      facetGroupsResolved.forEach((group) => {
        // rebuild facets!
        debug(`find '${this.name}': rebuilding facet "${group.facet}"`);

        facets[group.facet] = {
          ..._solr.facets[group.facet],
          buckets: group.items,
        };
      });
    }

    // merge results maintaining solr ordering.
    // results = _solr.response.docs.map((doc) => {
    //   let newspaper = doc.newspaper;
    //   let cols = [];
    //
    //   if (facets.newspaper && facets.newspaper.buckets) {
    //     const facetedNewspaper = facets.newspaper.buckets.find(n => n.uid === newspaper.uid);
    //     if (facetedNewspaper.item) {
    //       newspaper = new Newspaper(facetedNewspaper.item);
    //     }
    //   }
    //   if (collections && collections[doc.uid]) {
    //     cols = collections[doc.uid].map(d => d.collection);
    //   }
    //   return {
    //     ...doc,
    //     ...itemsFromNeo4j[doc.uid] || {},
    //     collections: cols,
    //     newspaper,
    //   };
    // });

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
