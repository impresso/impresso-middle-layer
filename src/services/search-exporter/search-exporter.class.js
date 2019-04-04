/* eslint-disable no-unused-vars */
const debug = require('debug')('impresso/services:search');
const solr = require('../../solr');
const article = require('../../models/articles.model');
const { NotFound, NotImplemented } = require('@feathersjs/errors');

class Service {
  constructor(options) {
    this.solr = solr.client(options.app.get('solr'));
    this.name = options.name;
    this.options = options || {};
    this.app = options.app;
  }

  async create(data, params) {
    const client = this.app.get('celeryClient');
    if (!client) {
      return {};
    }

    const q = params.sanitized.sq;

    debug(`create '${this.name}', from solr query: ${q}`);

    return client.run({
      task: 'impresso.tasks.export_query_as_csv',
      args: [
        // query
        q,
        // user id
        params.user.id,
        // description
        data.sanitized.description || '',
      ],
    }).catch((err) => {
      if (err.result.exc_type === 'DoesNotExist') {
        throw new NotFound(err.result.exc_message);
      } else if (err.result.exc_type === 'OperationalError') {
        // probably db is not availabe
        throw new NotImplemented();
      }
      console.error(err);
      throw new NotImplemented();
    });
  }
  async find(params) {
    // override params limit according to user role.
    params.query.limit = 2;
    if (params.user) {
      // is authentified
      params.query.limit = params.user.is_staff ? 500 : 100;
    }

    debug(`find '${this.name}': query:`, params.query);

    const _solr = await this.solr.findAll({
      q: params.query.sq,
      order_by: params.query.order_by,
      limit: params.query.limit,
      skip: params.query.skip,
      fl: params.user.is_staff ?
        article.ARTICLE_SOLR_FL_TO_CSV.concat(['content_txt_fr']) :
        article.ARTICLE_SOLR_FL_TO_CSV,
    }, article.solrFactory);

    const total = _solr.response.numFound;
    debug(`find '${this.name}': SOLR found ${total} using SOLR params:`, _solr.responseHeader.params);

    if (!total) {
      return {
        records: [],
        headers: [],
      };
    }

    return {
      records: _solr.response.docs.map(d => d.toCSV()),
      headers: Object.keys(_solr.response.docs[0]),
    };
  }
}

module.exports = function (options) {
  return new Service(options);
};

module.exports.Service = Service;
