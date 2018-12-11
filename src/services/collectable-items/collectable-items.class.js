/* eslint-disable no-unused-vars */
const debug = require('debug')('impresso/services/collectable-items');
const { NotFound } = require('@feathersjs/errors');

const SequelizeService = require('../sequelize.service');


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
    let where = {
      '$collection.creator_id$': params.user.id,
    };
    debug('find', params);
    // get all collectableItems by item ids
    if (params.sanitized.item_uids) {
      where = {
        itemId: {
          $in: params.sanitized.item_uids,
        },
        $or: [
          {
            '$collection.creator_id$': params.user.id,
          },
          {
            '$collection.status$': 'PUB',
          },
        ],
      };
    }

    const results = await this.SequelizeService.find({
      ...params,
      where,
    });

    console.log(results);

    return results;
    // const groups = {
    //   article: {
    //     service: 'articles',
    //     uids: [],
    //   },
    //   page: {
    //     service: 'pages',
    //     uids: [],
    //   },
    //   issue: {
    //     service: 'issues',
    //     uids: [],
    //   },
    // };
    //
    // // collect items uids
    // const uids = results.data.map((d, k) => {
    //   // add uid to list of uid per service.
    //   groups[d.labels[0]].uids.push(d.uid);
    //
    //   return {
    //     label: d.labels[0],
    //     uid: d.uid,
    //   };
    // });
  }

  async get(id, params) {
    return {
      id, text: `A new message with ID: ${id}!`,
    };
  }

  async create(data, params) {
    // get collection, only if it does belongs to the user
    const collection = await this.app
      .service('collections')
      .get(data.sanitized.collection_uid, {
        user: params.user,
      });
    if (!collection) {
      throw new NotFound();
    }
    const items = data.sanitized.items.map(d => ({
      itemId: d.uid,
      contentType: d.content_type,
      collectionId: collection.uid,
    }));

    const results = await this.SequelizeService.bulkCreate(items);
    return {
      data: results.map(d => d.toJSON()),
      info: {
        created: results.length,
      },
    };
  }


  async remove(id, params) {
    // get collection, only if it does belongs to the user
    const collection = await this.app
      .service('collections')
      .get(params.sanitized.collection_uid, {
        user: params.user,
      });
    if (!collection) {
      throw new NotFound();
    }
    const results = await this.SequelizeService.sequelizeKlass.destroy({
      where: {
        $or: params.sanitized.items.map(d => ({
          itemId: d.uid,
          collectionId: params.sanitized.collection_uid,
        })),
      },
    });
    return {
      params: params.sanitized,
      removed: parseInt(results, 10),
    };
  }
}

module.exports = function (options) {
  return new Service(options);
};

module.exports.Service = Service;
