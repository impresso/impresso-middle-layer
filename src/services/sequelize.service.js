/* eslint global-require: "off" */
/* eslint import/no-dynamic-require: "off" */
const debug = require('debug')('impresso/services:SequelizeService');
const sequelize = require('../sequelize');
const { NotFound } = require('@feathersjs/errors');
const { sequelizeErrorHandler } = require('./sequelize.utils');

class SequelizeService {
  constructor({
    name = '',
    app = null,
  } = {}) {
    this.name = String(name);

    this.sequelize = sequelize.client(app.get('sequelize'));

    this.Model = require(`../models/${this.name}.model`);
    this.sequelizeKlass = this.Model.sequelize(this.sequelize);

    debug(`Configuring service: ${this.name} success`);
  }

  async bulkCreate(items) {
    return this.sequelizeKlass.bulkCreate(items).catch(this.onError);
  }

  onError(err) {
    sequelizeErrorHandler(err);
  }

  async bulkRemove(where) {
    return this.sequelizeKlass.destroy({
      where,
    }).catch(this.onError);
  }

  async get(id, params) {
    let fn = this.sequelizeKlass;

    const where = params.where || {
      id,
    };

    if (params.scope) {
      fn = this.sequelizeKlass.scope(params.scope);
    }
    debug(`'get' ${this.name} with params:`, params);

    const result = await fn.findOne({
      where,
    }).catch(this.onError);

    if (!result) {
      throw new NotFound();
    }

    debug(`'get' ${this.name} success!`);

    return result;
  }

  /**
   * Call sequelize update and return given id
   * and the data that have been updated for the object
   *
   * @param  {[type]}  id     id of the
   * @param  {[type]}  data   [description]
   * @param  {[type]}  params [description]
   * @return {Promise}        [description]
   */
  async patch(id, data, params) {
    if (id) {
      params.where = {
        ...params.where,
        id,
      };
    }
    return this.sequelizeKlass.update({
      ...data,
    }, {
      // criteria
      where: params.where,
    }).then(() => ({
      uid: id,
      ...data,
    }));
  }

  async rawSelect({
    query = '',
    replacements = {},
  } = {}) {
    return this.sequelize.query(query, {
      replacements,
      type: this.sequelize.QueryTypes.SELECT,
    }).catch(sequelizeErrorHandler);
  }

  async find(params) {
    // we should be sure that ONLY those ones are in place.
    // should you need more, you can use this.sequelizeKlass
    // directly.
    const p = {
      // for paginations.
      limit: params.limit || params.query.limit,
      offset: params.skip || params.query.skip,
      order: params.order_by || params.query.order_by,
    };

    if (params.where) {
      p.where = params.where;
    }
    if (params.group) {
      p.group = params.group;
    }

    // force distinct if needed
    if (params.distinct) {
      p.distinct = true;
      const pk = this.sequelizeKlass.primaryKeyAttributes[0];
      p.col = `${this.sequelizeKlass.name}.${this.sequelizeKlass.primaryKeys[pk].field}`;
    }

    debug(`'find' ${this.name} with params:`, p, 'where:', p.where);

    let fn = this.sequelizeKlass;

    if (params.scope) {
      fn = this.sequelizeKlass.scope(params.scope);
    }

    return fn.findAndCountAll(p)
      .catch(sequelizeErrorHandler)
      .then((res) => {
        debug(`'find' ${this.name} success, n.results:`, res.count);
        return res;
      })
      .then(res => ({
        data: res.rows.map(d => d.toJSON()),
        total: res.count,
        limit: params.query.limit,
        skip: params.query.skip,
        info: {
          query: params.query,
        },
      }));
  }
}


module.exports = function (options) {
  return new SequelizeService(options);
};

module.exports.Service = SequelizeService;
