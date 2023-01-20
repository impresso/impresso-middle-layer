/* eslint-disable no-unused-vars */
const debug = require('debug')('impresso/services/bucket-items');
const { NotImplemented } = require('@feathersjs/errors');
const lodash = require('lodash');
const Neo4jService = require('../neo4j.service').Service;

class Service extends Neo4jService {
  /**
   * async create - add items to a specific bucket.
   *
   * ```
   * POST as JSON(application/json)
   * {
   *    "bucket_uid": "5440949e-77c0-42f5-a41b-045183e215c7",
   *    "items": [{
   *      "label": "article",
   *      "uid": "GDL-1811-11-22-a-i0004"
   *    }]
   *  }
   *  ```
   * @param  {object} data   It contains: 'santified' see above.
   * @param  {object} params access to user__uid and other query params
   * @return {object}        object
   */
  async create (data, params) {
    const result = await this._run(this.queries.create, {
      _exec_user_uid: params.user.uid,
      bucket_uid: data.sanitized.bucket_uid,
      items: data.sanitized.items,
      // _type: 'add-buckets-items'
    });

    return this._finalizeCreate(result);
  }

  // resolve bucket-items based on ther own label
  async find (params) {
    // neo4j service find method, perform cypher query
    const results = await super.find(params);

    const groups = {
      article: {
        service: 'articles',
        uids: [],
      },
      page: {
        service: 'pages',
        uids: [],
      },
      issue: {
        service: 'issues',
        uids: [],
      },
    };

    // collect items uids
    const uids = results.data.map((d, k) => {
      // add uid to list of uid per service.
      groups[d.labels[0]].uids.push(d.uid);

      return {
        label: d.labels[0],
        uid: d.uid,
      };
    });
    debug('find: <uids>:', uids);
    // if articles
    return Promise.all(lodash(groups)
      .filter(d => d.uids.length)
      .map(d => this.app.service(d.service).get(d.uids.join(','), {
        query: {},
        user: params.user,
        findAll: true, // this makes "findall" explicit, thus forcing the result as array
      })).value()).then((values) => {
      const flattened = lodash(values).flatten().keyBy('uid').value();
      // console.log('VALUES', results.data.map(d => ({
      //   ...d,
      //   ...flattened[d.uid],
      // })));
      // enrich with received data
      return results.data.map(d => ({
        ...d,
        ...flattened[d.uid],
      }));
    });
  }

  async remove (id, params) {
    //
    const result = await this._run(this.queries.remove, {
      _exec_user_uid: params.user.uid,
      bucket_uid: id,
      items: params.query.items,
    });
    debug('remove:', id, 'stats:', result.summary.counters._stats);
    return this._finalizeCreate(result);
  }
}

module.exports = function (options) {
  return new Service(options);
};

module.exports.Service = Service;
