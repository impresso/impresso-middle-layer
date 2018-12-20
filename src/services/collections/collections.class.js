const Collection = require('../../models/collections.model');
const SequelizeService = require('../sequelize.service');

/* eslint-disable no-unused-vars */
class Service {
  constructor({
    name = '',
    app = null,
  } = {}) {
    this.name = String(name);
    this.SequelizeService = SequelizeService({
      app,
      name,
    });
  }

  async find(params) {
    const where = {
      $and: [],
    };

    if (params.user) {
      where.$and.push({
        $or: [
          { creatorId: params.user.id },
          { status: Collection.STATUS_PUBLIC },
        ],
      });
    } else {
      where.$and.push({
        status: Collection.STATUS_PUBLIC,
      });
    }

    if (params.query.item_uid) {
      where.$and.push({
        itemId: params.query.item_uid,
      });
    }

    if (params.query.q) {
      where.$and.push({
        $or: [
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
    const where = {
      uid: id,
    };

    if (params.user) {
      where.$or = [
        { '$creator.profile.uid$': params.user.uid },
        { status: { $in: [Collection.STATUS_PUBLIC, Collection.STATUS_SHARED] } },
      ];
    } else {
      where.status = {
        $in: [Collection.STATUS_PUBLIC, Collection.STATUS_SHARED],
      };
    }
    return this.SequelizeService.get(id, {
      where,
    });
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
    return { id };
  }

  // async removeAll(params) {
  //   if (!params.user.isStaff) {
  //     throw new NotImplemented();
  //   }
  //   // cannot be called from
  //   const where = {
  //     $or: [
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
