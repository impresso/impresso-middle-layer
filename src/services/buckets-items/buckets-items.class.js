/* eslint-disable no-unused-vars */
const Neo4jService = require('../neo4j.service').Service;
const { NotImplemented } = require('@feathersjs/errors');
const lodash = require('lodash');

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
  async create(data, params) {
    const result = await this._run(this.queries.create, {
      _exec_user_uid: params.user.uid,
      bucket_uid: data.sanitized.bucket_uid,
      items: data.sanitized.items,
      // _type: 'add-buckets-items'
    });

    return this._finalizeCreate(result);
  }

  async find(params) {
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

    // if articles
    return Promise.all(lodash(groups)
      .filter(d => d.uids.length)
      .map(d => this.app.service(d.service).get(d.uids.join(','), {
        query: {},
        user: params.user,
        findAll: true,
      })).value()).then((values) => {
      const flattened = lodash(values).flatten().keyBy('uid').value();
      // enrich
      return results.data.map(d => ({
        d,
        ...flattened[d.uid],
      }));
    });
  }

  async remove(id, params) {
    //
    const result = await this._run(this.queries.remove, {
      _exec_user_uid: params.user.uid,
      bucket_uid: id,
      items: params.query.items,
    });

    return this._finalizeCreate(result);
  }
}

module.exports = function (options) {
  return new Service(options);
};

module.exports.Service = Service;
