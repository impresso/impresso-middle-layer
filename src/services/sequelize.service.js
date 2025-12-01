/* eslint global-require: "off" */
import Debug from 'debug'
import { Model } from 'sequelize'
const debug = Debug('impresso/services:SequelizeService')
import { NotFound } from '@feathersjs/errors'
// import sequelize from '../sequelize.js'
import { sequelizeErrorHandler } from './sequelize.utils.js'
import { getCacheKey } from '../util/serialize.js'

export function getCacheKeyForReadSqlRequest(request, modelName) {
  const key = getCacheKey(request)
  return ['cache', 'db', modelName != null ? modelName : 'unk', key].join(':')
}

const loadDynamicModule = async name => {
  // Try to add .js extension if it doesn't have one
  const modulePath = name.endsWith('.js') ? name : `${name}.js`
  return import(modulePath).catch(e => {
    // Fallback to CommonJS require as a last resort
    console.warn(`Warning: Falling back to CommonJS require for ${name}. Consider updating import. Error: ${e}`)
    return require(name)
  })
}

export class Service {
  constructor({ name = '', app = null, modelName = null, cacheReads = false } = {}) {
    this.name = String(name)
    this.modelName = String(modelName || name)
    // this.sequelize = sequelize.client(app.get('sequelize'))
    this.sequelize = app.get('sequelizeClient')
    loadDynamicModule(`../models/${this.modelName}.model`)
      .then(m => {
        let isConfigured = false
        for (const modelCandidate of [m.default?.default, m.default, m]) {
          if (isConfigured) break
          if (!modelCandidate) continue

          this.Model = modelCandidate

          if (this.Model.prototype instanceof Model) {
            this.sequelizeKlass = this.Model.initialize(this.sequelize)
            debug(`Configuring new style Sequelize service: ${this.name} (model:${this.modelName}) success!`)
            isConfigured = true
          } else if (typeof this.Model.sequelize === 'function') {
            this.sequelizeKlass = this.Model.sequelize(this.sequelize, app)
            debug(`Configuring old style Sequelize service: ${this.name} (model:${this.modelName}) success!`)
            isConfigured = true
          }
        }
        if (!isConfigured) {
          throw new Error(`Sequelize Model not found in import: ${this.modelName}`)
        }
      })
      .catch(err => {
        throw new Error(`Sequelize Model not found in import: ${this.modelName}: ${err.message}`, err)
      })

    this.cacheReads = cacheReads
    this.cacheManager = app.get('cacheManager')

    debug(`Configuring service: ${this.name} (model:${this.modelName}) success. Caching reads: ${this.cacheReads}`)
  }

  async bulkCreate(items) {
    return this.sequelizeKlass.bulkCreate(items, { ignoreDuplicates: true }).catch(this.onError)
  }

  async create(item) {
    return this.sequelizeKlass.create(item).catch(this.onError)
  }

  onError(err) {
    sequelizeErrorHandler(err)
  }

  async bulkRemove(where) {
    return this.sequelizeKlass
      .destroy({
        where,
      })
      .catch(this.onError)
  }

  async get(id, params) {
    let fn = this.sequelizeKlass

    const where = params.where || {
      id,
    }

    if (params.scope) {
      fn = this.sequelizeKlass.scope(params.scope)
    }
    debug(`'get' ${this.name} with params:`, params)

    const result = await fn
      .findOne({
        where,
      })
      .catch(this.onError)

    if (!result) {
      throw new NotFound()
    }

    debug(`'get' ${this.name} success!`)

    return result
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
      }
    }
    debug(`[patch] ${this.name} (model:${this.modelName}) with params:`, params, 'field to update:', Object.keys(data))
    return this.sequelizeKlass
      .update(
        {
          ...data,
        },
        {
          // criteria
          where: params.where,
        }
      )
      .then(() => ({
        uid: id,
        ...data,
      }))
  }

  async rawSelect({ query = '', replacements = {} } = {}) {
    return this.sequelize
      .query(query, {
        replacements,
        type: this.sequelize.QueryTypes.SELECT,
      })
      .catch(sequelizeErrorHandler)
  }

  async find(params, ttl = undefined) {
    const cacheKey = getCacheKeyForReadSqlRequest(params, this.modelName)
    const cacheOptions = ttl != null ? { ttl } : {}

    // we should be sure that ONLY those ones are in place.
    // should you need more, you can use this.sequelizeKlass
    // directly.
    const p = {
      // for paginations.
      limit: params.limit ?? params.query?.limit,
      offset: params.offset ?? params.query?.offset,
      order: params.order_by ?? params.query?.order_by,
    }

    if (params.include) {
      p.include = params.include
    }

    if (params.where) {
      p.where = params.where
    }
    if (params.group) {
      p.group = params.group
    }

    // force distinct if needed
    if (params.distinct) {
      p.distinct = true
      const pk = this.sequelizeKlass.primaryKeyAttributes[0]
      p.col = `${this.sequelizeKlass.name}.${this.sequelizeKlass.primaryKeys[pk].field}`
    }

    debug(`'find' ${this.name} with params (cached: ${this.cacheReads}):`, p, 'where:', p.where)

    let fn = this.sequelizeKlass

    if (params.scope) {
      fn = this.sequelizeKlass.scope(params.scope)
    }

    const getFromDb = async () => {
      const promise = params.findAllOnly ? fn.findAll(p) : fn.findAndCountAll(p)
      const dbResultPromise = promise
        .then(res => {
          if (params.findAllOnly) {
            debug(`'find' ${this.name} success, no count has been asked.`)
            return {
              rows: res,
              count: -1,
            }
          }
          debug(`'find' ${this.name} success, n.results:`, res.count)
          return res
        })
        .then(res => ({
          data: res.rows.map(d => d.toJSON()),
          total: res.count,
          limit: p.limit,
          offset: p.offset,
          info: {
            query: {
              filters: params.query?.filters,
              limit: p.limit,
              offset: p.offset,
            },
          },
        }))
      return dbResultPromise
    }
    const cachedPromise = this.cacheReads ? this.cacheManager.wrap(cacheKey, getFromDb, cacheOptions.ttl) : getFromDb()

    return cachedPromise.catch(sequelizeErrorHandler)
  }
}

export default function (options) {
  return new Service(options)
}
