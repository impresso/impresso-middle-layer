/* eslint-disable no-unused-vars */
const debug = require('debug')('impresso/services:search');
const { NotFound, NotImplemented } = require('@feathersjs/errors');
const { protobuf } = require('impresso-jscommons');
const solr = require('../../solr');
const article = require('../../models/articles.model');

class Service {
  constructor(options) {
    this.solr = solr.client(options.app.get('solr'), options.app.get('solrConnectionPool'));
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
    debug('[create] from solr query:', q, 'filters:', params.sanitized.filters);

    const pq = protobuf.searchQuery.serialize({
      filters: params.sanitized.filters,
    });
    debug('[create] protobuffered:', pq);


    return client.run({
      task: 'impresso.tasks.export_query_as_csv',
      args: [
        // user id
        params.user.id,
        // query
        q,
        // description
        data.sanitized.description || '',
        // query_hash
        pq,
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
}

module.exports = function (options) {
  return new Service(options);
};

module.exports.Service = Service;
