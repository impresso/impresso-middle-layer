const sequelize = require('../../sequelize');
const { sequelizeErrorHandler } = require('../../services/sequelize.utils');
const { NotFound } = require('@feathersjs/errors');

const Collection = require('../../models/collections.model');

/* eslint-disable no-unused-vars */
class Service {
  constructor(options) {
    this.options = options || {};
    this.name = options.name;
    this.configs = {
      sequelize: options.app.get('sequelize'),
    };
    this.sequelize = sequelize.client(this.configs.sequelize);
    this.sequelizeKlass = Collection.sequelize(this.sequelize);
  }

  async find(params) {
    const where = {
      $and: [],
    }

    if(params.user) {
      where.$and.push({ $or: [
        { creatorId: params.user.id, },
        { status: Collection.STATUS_PUBLIC,}
      ]});
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
      where.$and.push({ $or: [
        { name: params.query.q, },
        { description: params.query.q, },
      ]});
    }

    // get list of collections
    const collections = await this.sequelizeKlass.scope('get').findAndCountAll({
      where,

      offset: params.query.skip,
      limit: params.query.limit,
      // order by
      order: [
        params.query.order_by,
      ],
    });

    return {
      data: collections.rows,
      skip: params.query.skip,
      limit: params.query.limit,
      total: collections.count,
      info: {
        q: params.query.q,
      }
    };
  }

  async get(id, params) {
    const where = {
      uid: id,
      $or: [
        {
          '$creator.profile.uid$': params.user.uid,
        },
        {
          '$creator.id$': params.user.id,
        },
      ],
      // $or: [
      //   {
      //     status: Collection.STATUS_PUBLIC,
      //     '$creator.profile.uid$': params.user.uid,
      //   },
      // ],
    };

    const collection = await this.sequelizeKlass.scope('get').findOne({
      where,
    });

    if (!collection) {
      throw new NotFound();
    } else {
      return new Collection(collection.toJSON());
    }
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

    const result = await this.sequelizeKlass
      .create({
        ...collection,
        creator_id: collection.creator.id,
      })
      .catch(sequelizeErrorHandler);

    console.log(collection, 'result', result);
    return collection;
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
