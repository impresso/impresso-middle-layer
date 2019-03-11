/* eslint-disable no-unused-vars */
const debug = require('debug')('impresso/services:jobs');
const SequelizeService = require('../sequelize.service');
const { BadGateway, NotFound, NotImplemented } = require('@feathersjs/errors');

class Service {
  constructor({
    name = '',
    app = null,
  } = {}) {
    this.name = name;
    this.app = app;
    this.SequelizeService = SequelizeService({
      app,
      name,
    });
  }

  async find(params) {
    const where = {
      creatorId: params.user.id,
    };

    return this.SequelizeService.find({
      query: {
        ...params.query,
      },
      where,
    });
  }

  async get(id, params) {
    return {
      id, text: `A new message with ID: ${id}!`,
    };
  }

  async create(data, params) {
    // create a test job
    const client = this.app.get('celeryClient');

    if (!client) {
      throw new BadGateway('celery is not ready');
    }

    debug(`create '${this.name}', test task`);

    return client.run({
      task: 'impresso.tasks.test',
      args: [
        // user id
        params.user.id,
      ],
    }).catch((err) => {
      if (err.result.exc_type === 'DoesNotExist') {
        throw new NotFound(err.result.exc_message);
      } else if (err.result.exc_type === 'OperationalError') {
        // probably db is not availabe
        throw new NotImplemented();
      }
      throw new NotImplemented();
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
