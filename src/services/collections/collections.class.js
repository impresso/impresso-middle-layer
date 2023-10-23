/* eslint-disable no-unused-vars */
const debug = require('debug')('impresso/services:collections');
const { pick, identity } = require('lodash');
const { Op } = require('sequelize');
const { BadGateway } = require('@feathersjs/errors');

const Collection = require('../../models/collections.model');
const SequelizeService = require('../sequelize.service');
const { measureTime } = require('../../util/instruments');

class Service {
  constructor (options) {
    this.options = options || {};
  }

  setup (app) {
    this.app = app;
    this.name = 'collections';
    this.sequelizeService = new SequelizeService({
      app,
      name: this.name,
    });
    debug('[setup] completed');
  }

  async find (params) {
    const where = {
      [Op.not]: { status: Collection.STATUS_DELETED },
      [Op.and]: [{
        [Op.or]: [
          { creatorId: params.user.id },
          { status: Collection.STATUS_PUBLIC },
        ],
      }],
    };

    if (params.query.uids) {
      where[Op.and].push({
        uid: { [Op.in]: params.query.uids },
      });
    }

    if (params.query.q) {
      where[Op.and].push({
        [Op.or]: [
          { name: params.query.q },
          { description: params.query.q },
        ],
      });
    }

    return measureTime(() => this.sequelizeService.find({
      query: {
        ...params.query,
      },
      where,
    }), 'collections.db.find');
  }

  async get (id, params) {
    const uids = id.split(',');
    if (params.findAll || (uids.length > 1 && uids.length < 20)) {
      return this.find({
        ...params,
        query: {
          ...params.query,
          uids,
        },
      }).then(d => d.data);
    }
    const where = {
      uid: id,
    };

    if (!params.query.nameOnly) {
      if (params.user) {
        where[Op.not] = { status: { [Op.in]: [Collection.STATUS_DELETED] } };
        where[Op.or] = [
          { '$creator.profile.uid$': params.user.uid },
          { status: { [Op.in]: [Collection.STATUS_PUBLIC, Collection.STATUS_SHARED] } },
        ];
      } else {
        where.status = {
          [Op.in]: [Collection.STATUS_PUBLIC, Collection.STATUS_SHARED],
        };
      }
    }

    const transform = params.query.nameOnly
      ? c => pick(c, ['uid', 'name', 'description'])
      : identity;

    return measureTime(() => this.sequelizeService.get(id, {
      where,
    }).then(collection => transform(collection.toJSON())), 'collections.db.get');
  }

  async create (data, params) {
    debug('[create]', data);
    const collection = new Collection({
      ...data.sanitized,
      creator: params.user,
    });

    return this.sequelizeService.create({
      ...collection,
      creatorId: collection.creator.id,
    });
  }

  async update (id, data, params) {
    return data;
  }

  async patch (id, data, params) {
    // get the collection
    return this.sequelizeService.patch(id, data.sanitized, {
      where: {
        creatorId: params.user.id,
      },
    });
  }

  async remove (id, params) {
    debug(`[remove] id:${id}, params.user.uid:${params.user.uid}`);
    const result = await this.sequelizeService.patch(id, {
      status: Collection.STATUS_DELETED,
    }, {
      where: {
        creatorId: params.user.id,
      },
    });
    debug(`[remove] id:${id}, patch status to DEL. Running celery task "remove_collection"...`);
    return this.app.get('celeryClient').run({
      task: 'impresso.tasks.remove_collection',
      args: [
        // collection_uid
        id,
        // user id
        params.user.id,
      ],
    }).then((res) => {
      debug(`[remove] id:${id} celery task launched`, res.status, res.date_done);
      return {
        params: {
          id,
          status: Collection.STATUS_DELETED,
        },
        task: {
          task_id: res.task_id,
          creationDate: res.date_done,
        },
      };
    }).catch((err) => {
      debug(`[remove] id:${id} celery task FAILED:`, err);
      throw new BadGateway('celeryUnreachable');
    });
  }

  // async removeAll(params) {
  //   if (!params.user.isStaff) {
  //     throw new NotImplemented();
  //   }
  //   // cannot be called from
  //   const where = {
  //     [Op.or]: [
  //       {
  //         status: Collection.STATUS_PUBLIC,
  //         '$creator.profile.uid$': params.user.uid,
  //       },
  //     ],
  //   };
  //
  //   const collection = await this.sequelizeKlass.scope('get').findAll({
  //     where,
  //   });
  // }
}

module.exports = function (options) {
  return new Service(options);
};

module.exports.Service = Service;
