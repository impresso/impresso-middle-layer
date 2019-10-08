/* eslint-disable no-unused-vars */
const debug = require('debug')('impresso/services:uploaded-images');
const verbose = require('debug')('verbose:impresso/services:uploaded-images');
const { Op } = require('sequelize');
const { NotFound } = require('@feathersjs/errors');
const UploadedImage = require('../../models/uploaded-images.model');
const SequelizeService = require('../sequelize.service');

/* eslint-disable no-unused-vars */
class Service {
  constructor({
    name = '',
    app = null,
  } = {}) {
    this.name = String(name);
    this.app = app;
    this.SequelizeService = SequelizeService({
      app,
      name,
    });
  }

  async find(params) {
    return this.SequelizeService.find(params);
  }

  async get(id, params) {
    debug(`[get] id: ${id} check REDIS if an image has been uploaded KEY:"img:${id}"`);
    const cachedImage = await this.app.get('redisClient').get(`img:${id}`);

    if (cachedImage) {
      debug('[get] id:', id, 'found uploaded image in REDIS, with hash:', cachedImage.uid);
      return new UploadedImage(JSON.parse(cachedImage));
    }

    debug('[get] id:', id, 'looking for existing images');
    return this.SequelizeService.get(id, {
      where: {
        [Op.or]: [
          { uid: id },
          { checksum: id },
        ],
      },
    }).then((result) => {
      console.log(result);
      debug('get result:', result);
      return result;
    });
  }

  create(data, params) {
    const app = this.app;
    debug('create', data);
    return new Promise((resolve, reject) => {
      const redisClient = app.get('redisClient');

      redisClient.hgetall(data.id).then((image) => {
        redisClient.del(data.id);

        const uploadedImage = new UploadedImage(image);

        this.SequelizeService.create({
          ...uploadedImage,
          creatorId: params.user.id,
        }).then(resolve, reject).catch(reject);
      }, reject).catch(reject);
    });
  }

  async update(id, data, params) {
    return data;
  }

  async patch(id, data, params) {
    return data;
  }

  async remove(id, params) {
    return { id };
  }
}

module.exports = function (options) {
  return new Service(options);
};

module.exports.Service = Service;
