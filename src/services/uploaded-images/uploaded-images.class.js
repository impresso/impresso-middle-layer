/* eslint-disable no-unused-vars */
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

  get(id, params) {
    return new Promise((resolve, reject) => {
      this.create({ id }, params).then(resolve, () => {
        this.SequelizeService.get(id, {
          where: {
            uid: id,
          },
        }).then(resolve, reject);
      }).catch(reject);
    });
  }

  create(data, params) {
    const app = this.app;

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
