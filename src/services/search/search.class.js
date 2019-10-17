const debug = require('debug')('impresso/services:search');
const decypher = require('decypher');
const { NotFound, NotImplemented } = require('@feathersjs/errors');
const solr = require('../../solr');
const neo4j = require('../../neo4j');
const sequelize = require('../../sequelize');

const Article = require('../../models/articles.model');

const {
  getItemsFromSolrResponse,
  getFacetsFromSolrResponse,
  getTotalFromSolrResponse,
} = require('../search/search.extractors');


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

  static asRawResponse(solrResponse, params, total) {
    return Service.wrap(solrResponse.response.docs.map((d) => {
      // console.log(_solr.fragments[d.id]);
      const contentField = Object.keys(solrResponse.fragments[d.id])[0];
      // const contentField = _solr.fragments[d.id][`content_txt_${d.lg_s}`]
      // ? `content_txt_${d.lg_s}` : 'content_txt_fr';
      const fragments = solrResponse.fragments[d.id][contentField];
      const highlights = solrResponse.highlighting[d.id][contentField];
      return {
        id: d.id,
        matches: Article.getMatches({
          solrDocument: d,
          highlights,
          fragments,
        }),
        contentField,
      };
    }), params.query.limit, params.query.skip, total);
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

    // quickly save the data!
    const q = data.sanitized.sq;

    // create new search query :TODO
    debug(`[create] from solr query: ${q} from user:${params.user.uid}`);

    return client.run({
      task: 'impresso.tasks.add_to_collection_from_query',
      args: [
        // collection_uid
        data.sanitized.collection_uid,
        // user id
        params.user.id,
        // query ID
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
    }).then((res) => {
      debug('[create] impresso.tasks.add_to_collection_from_query SUCCESS.', res);
      return {};
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
    const isRaw = params.originalQuery.group_by === 'raw';

    const solrQuery = {
      q: params.query.sq,
      // fq: params.sanitized.sfq,
      order_by: params.query.order_by,
      facets: params.query.facets,
      limit: params.query.limit,
      skip: params.query.skip,
      fl: 'id,pp_plain:[json],lg_s', // other fields can be loaded later on
      highlight_by: 'content_txt_de,content_txt_fr,content_txt_en',
      highlightProps: {
        'hl.snippets': 10,
        'hl.fragsize': 100,
      },
      vars: params.sanitized.sv,
    };

    const solrResponse = await this.solr.findAll(solrQuery);

    const total = getTotalFromSolrResponse(solrResponse);
    debug(`find '${this.name}' (1 / 2): SOLR found ${total} using SOLR params:`, solrResponse.responseHeader.params);

    if (!total) {
      return Service.wrap([], params.query.limit, params.query.skip, total);
    }

    if (isRaw) {
      return Service.asRawResponse(solrResponse, params, total);
    }

    const userInfo = {
      user: params.user,
      authenticated: params.authenticated,
    };

    debug(
      `find '${this.name}' (2 / 2): call articles service for ${solrResponse.response.docs.length} uids, user:`,
      params.user ? params.user.uid : 'no auth user found',
    );

    const resultItems = await getItemsFromSolrResponse(solrResponse, this.app.service('articles'), userInfo);
    const facets = await getFacetsFromSolrResponse(solrResponse);

    return Service.wrap(resultItems, params.query.limit, params.query.skip, total, {
      responseTime: {
        solr: solrResponse.responseHeader.QTime,
      },
      facets,
    });
  }
}

module.exports = function (options) {
  return new Service(options);
};

module.exports.Service = Service;
