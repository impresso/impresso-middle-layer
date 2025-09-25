/* eslint-disable no-unused-vars */
import Debug from 'debug'
const debug = Debug('impresso/services:uploaded-images')
const verbose = Debug('verbose:impresso/services:uploaded-images')
import { Op } from 'sequelize'
import { NotFound } from '@feathersjs/errors'
import UploadedImage from '../../models/uploaded-images.model.js'
import SequelizeService from '../sequelize.service.js'

/* eslint-disable no-unused-vars */
export class Service {
  constructor({ name = '', app = null } = {}) {
    this.name = String(name)
    this.app = app
    this.SequelizeService = SequelizeService({
      app,
      name,
    })
  }

  async find(params) {
    return this.SequelizeService.find(params)
  }

  async get(id, params) {
    debug(`[get] id: ${id} check REDIS if an image has been uploaded KEY:"img:${id}"`)
    const cachedImage = await this.app.service('redisClient').client.get(`img:${id}`)

    if (cachedImage) {
      debug('[get] id:', id, 'found uploaded image in REDIS, with hash:', cachedImage.uid)
      return new UploadedImage(JSON.parse(cachedImage))
    }

    debug('[get] id:', id, 'looking for existing images')
    return this.SequelizeService.get(id, {
      where: {
        [Op.or]: [{ uid: id }, { checksum: id }],
      },
    }).then(result => {
      debug('get result:', result)
      return result
    })
  }

  create(data, params) {
    const app = this.app
    debug('create', data)
    return new Promise((resolve, reject) => {
      const redisClient = app.service('redisClient').client

      redisClient
        .hgetall(data.id)
        .then(image => {
          redisClient.del(data.id)

          const uploadedImage = new UploadedImage(image)

          this.SequelizeService.create({
            ...uploadedImage,
            creatorId: params.user.id,
          })
            .then(resolve, reject)
            .catch(reject)
        }, reject)
        .catch(reject)
    })
  }

  async update(id, data, params) {
    return data
  }

  async patch(id, data, params) {
    return data
  }

  async remove(id, params) {
    return { id }
  }
}

export default function (options) {
  return new Service(options)
}
