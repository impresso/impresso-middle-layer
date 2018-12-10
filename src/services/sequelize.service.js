/* eslint global-require: "off" */
/* eslint import/no-dynamic-require: "off" */
const debug = require('debug')('impresso/services:SequelizeService');
const sequelize = require('../sequelize');
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
    return sequelizeErrorHandler(err);
  }

  static wrapMany(results) {

  }

  async bulkRemove(where) {
    return this.sequelizeKlass.destroy({
      where,
    }).catch(this.onError);
  }

  async find(params) {
    // we should be sure that ONLY those ones are in place.
    // should you need more, you can use this.sequelizeKlass
    // directly.
    const p = {
      // for paginations.
      limit: params.query.limit,
      offset: params.query.skip,
      order: params.query.order_by,
    };
    debug(`'find' ${this.name} with params:`, p);
    if(params.where) {
      p.where = params.where;
    }
    if(params.distinct) {
      p.distinct = params.distinct;
    }

    let fn = this.sequelizeKlass;

    if(params.scope) {
      fn = this.sequelizeKlass.scope(params.scope);
    }

    return fn.findAndCountAll(p)
      .catch(sequelizeErrorHandler)
      .then(res => {
        console.log(res.rows[0].toJSON());
        return res;
      })
      .then(res => ({
        data: res.rows.map(d => new this.Model({
          ... d.toJSON()
        })),
        total: res.count,
        limit: params.query.limit,
        skip: params.query.skip,
      }));
  }
}


module.exports = function (options) {
  return new SequelizeService(options);
};

module.exports.Service = SequelizeService;
