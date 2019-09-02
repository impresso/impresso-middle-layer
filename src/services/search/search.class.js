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
      // fq: params.sanitized.sfq,
      order_by: params.query.order_by,
      facets: params.query.facets,
      limit: params.query.limit,
      skip: params.query.skip,
      fl: 'id,pp_plain:[json]', // for articles.
      highlight_by: 'content_txt_de,content_txt_fr,content_txt_en',
      highlight_props: {
        'hl.snippets': 10,
        'hl.fragsize': 100,
      },
      vars: params.sanitized.sv,
    });

    const total = _solr.response.numFound;
    debug(`find '${this.name}' (1 / 2): SOLR found ${total} using SOLR params:`, _solr.responseHeader.params);

    if (!total) {
      return Service.wrap([], params.query.limit, params.query.skip, total);
    }


    // index for the pp_plain
    const resultsIndex = lodash.keyBy(_solr.response.docs, 'id');
    // get uids to load addons...
    const uids = Object.keys(resultsIndex);
    // _solr.response.docs.map(d => d.id);

    // get text matches
    // const fragments = res.fragments[art.uid][`content_txt_${art.language}`];
    // const highlights = res.highlighting[art.uid][`content_txt_${art.language}`];
    
    debug(
      `find '${this.name}' (2 / 2): call articles service for ${uids.length} uids, user:`,
      params.user ? params.user.uid : 'no auth user found',
    );

    let results = [];

    if (uids.length) {
      // get articles (if group by is article ...)!
      results = await this.app.service('articles').find({
        user: params.user,
        authenticated: params.authenticated,
        query: {
          limit: uids.length,
          filters: [
            {
              type: 'uid',
              q: uids,
            },
          ],
        },
      })
        .then(res => res.data)
        .then((articles) => {
        // respect indexes
          const articleIndex = lodash(articles).map((article) => {
            // complete article with fragments found
            const fragments = _solr.fragments[article.uid][`content_txt_${article.language}`];
            const highlights = _solr.highlighting[article.uid][`content_txt_${article.language}`];
            article.matches = Article.getMatches({
              solrDocument: resultsIndex[article.uid],
              highlights,
              fragments,
            });
            // complete article with page regions
            article.regions = Article.getRegions({
              regionCoords: resultsIndex[article.uid].pp_plain,
            });
            if (article instanceof Article) {
              article.assignIIIF();
            } else {
              Article.assignIIIF(article);
            }

            return article;
          }).keyBy('uid').value();
          return uids.map(uid => articleIndex[uid]);
        });
    }
    // resolve facets...
    const facetGroupsToResolve = [];
    const facets = _solr.facets || {};
    // load from facets
    if (_solr.facets) {
      Object.keys(_solr.facets).forEach((facet) => {
        if (facet === 'newspaper') {
          facets[facet].buckets = facets[facet].buckets.map(d => ({
            ...d,
            item: Newspaper.getCached(d.val),
            uid: d.val,
          }));
        } else if (facet === 'topic') {
          facets[facet].buckets = facets[facet].buckets.map(d => ({
            ...d,
            item: Topic.getCached(d.val),
            uid: d.val,
          }));
        }
      });
    }

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
