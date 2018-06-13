/* eslint-disable no-unused-vars */
const Neo4jService = require('../neo4j.service').Service;
const { NotImplemented } = require('@feathersjs/errors');

class Service extends Neo4jService {
  /**
   * async create - add items to a specific bucket.
   *
   * ```
   * POST as JSON(application/json)
   * {
   *    "bucket_uid": "5440949e-77c0-42f5-a41b-045183e215c7",
   *    "items": [{
   *    	"label": "article",
   *    	"uid": "GDL-1811-11-22-a-i0004"
   *    }]
   *  }
   *  ```
   * @param  {object} data   It contains: 'santified' see above.
   * @param  {object} params access to user__uid and other query params
   * @return {object}        object
   */
  async create (data, params) {
    const result = await this._run(this.queries.create, {
      user__uid: params.query.user__uid,
      bucket_uid: data.sanitized.bucket_uid,
      items: data.sanitized.items,
      _type: 'add-buckets-items'
    });

    return this._finalizeCreate(result);
  }
}

module.exports = function (options) {
  return new Service(options);
};

module.exports.Service = Service;
