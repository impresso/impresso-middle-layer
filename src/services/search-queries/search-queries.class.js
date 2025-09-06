/* eslint-disable no-unused-vars */
import Debug from 'debug'
const debug = Debug('impresso/services:search-queries')
import SequelizeService from '../sequelize.service'
import SearchQuery from '../../models/search-queries.model'

export class SearchQueries {
  constructor(options) {
    this.options = options || {}
  }

  setup(app) {
    this.name = 'search-queries'
    this.sequelizeService = new SequelizeService({
      app,
      name: this.name,
    })
    debug('[setup] completed')
  }

  async find(params) {
    debug('[find] ...')
    return this.sequelizeService.find(params).then(res => {
      debug('[find] success', res.total)
      return res
    })
  }

  async get(id, params) {
    debug(`[get] id:${id} - params.user.uid: ${params.user.uid}`)
    const item = await this.sequelizeService.get(id, {
      where: {
        uid: id,
        creatorId: params.user.id,
      },
    })
    debug(`[get] id:${item.id} SUCCESS`)
    return item.toJSON()
  }

  async create(data, params) {
    debug('[create] params.user.uid:', params.user.uid, data)
    const searchQuery = new SearchQuery({
      ...data,
      creator: params.user,
    })

    return this.sequelizeService.create({
      ...searchQuery,
      creatorId: params.user.id,
    })
  }

  async update(id, data, params) {
    return data
  }

  async patch(id, data, params) {
    return data
  }

  async remove(id, params) {
    debug(`[remove] id: ${id} - params.user.uid: ${params.user.uid}`)
    return this.sequelizeService
      .bulkRemove({
        uid: id,
        creatorId: params.user.id,
      })
      .then(removed => ({
        params: {
          id,
        },
        removed,
      }))
  }
}
