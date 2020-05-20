/* eslint-disable no-unused-vars */
const debug = require('debug')('impresso/services:jobs');
const { BadGateway, NotFound, NotImplemented } = require('@feathersjs/errors');
const SequelizeService = require('../sequelize.service');
const { STATUS_KILLED, STATUS_DONE } = require('../../models/jobs.model');
const { measureTime } = require('../../util/instruments');

class Service {
  constructor(options) {
    this.options = options;
  }

  setup(app) {
    this.app = app;
    this.name = 'jobs';
    this.sequelizeService = new SequelizeService({
      app,
      name: this.name,
    });
  }

  async find(params) {
    const where = {
      creatorId: params.user.id,
    };

    return measureTime(() => this.sequelizeService.find({
      query: {
        ...params.query,
      },
      where,
    }), 'jobs.find.db.find');
  }

  async get(id, params) {
    const where = {
      id,
    };
    if (params.user.uid) {
      where['$creator.profile.uid$'] = params.user.uid;
    } else {
      where.creatorId = params.user.id;
    }
    return measureTime(() => this.sequelizeService.get(id, { where })
      .then(job => job.toJSON()), 'jobs.get.db.get');
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
    const where = {
      creatorId: params.user.id,
    };
    debug(`[patch] id:${id}, params.user.uid:${params.user.uid}, where:`, where);
    return this.sequelizeService.patch(id, {
      status: data.sanitized.status,
    }, { where });
  }

  async remove(id, params) {
    debug(`[remove] id:${id}, params.user.uid:${params.user.uid}`);
    return this.sequelizeService.bulkRemove({
      id,
      creatorId: params.user.id,
      status: [STATUS_KILLED, STATUS_DONE],
    }).then(removed => ({
      params: {
        id,
      },
      removed,
    }));
  }
}

module.exports = function (options) {
  return new Service(options);
};

module.exports.Service = Service;
