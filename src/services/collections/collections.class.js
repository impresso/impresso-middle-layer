const { pick, identity } = require('lodash');
const { Op } = require('sequelize');
const Collection = require('../../models/collections.model');
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

    return this.SequelizeService.find({
      query: {
        ...params.query,
      },
      where,
    });
  }

  async get(id, params) {
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
      ? c => pick(c, ['name', 'description'])
      : identity;

    return this.SequelizeService.get(id, {
      where,
    }).then(collection => transform(collection.toJSON()));
  }

  async create(data, params) {
    if (Array.isArray(data)) {
      return Promise.all(data.map(current => this.create(current, params)));
    }
    const collection = new Collection({
      ...data.sanitized,
      creator: params.user,
    });
    // get user

    const result = await this.SequelizeService.bulkCreate([{
      ...collection,
      creator_id: collection.creator.id,
    }]);

    return collection;
  }

  async update(id, data, params) {
    return data;
  }

  async patch(id, data, params) {
    // get the collection
    return this.SequelizeService.patch(id, data.sanitized, {
      where: {
        creatorId: params.user.id,
      },
    });
  }

  async remove(id, params) {
    return this.SequelizeService.patch(id, {
      status: Collection.STATUS_DELETED,
    }, {
      where: {
        creatorId: params.user.id,
      },
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
