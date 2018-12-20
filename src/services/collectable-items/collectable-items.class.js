/* eslint-disable no-unused-vars */
const lodash = require('lodash');
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
    // it can also be used for PUBlic collections.
    if (params.sanitized.collection_uid ||
        params.sanitized.item_uid ||
        params.sanitized.items_uid) {
      where = {
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

    if (params.sanitized.collection_uid) {
      where.collectionId = params.sanitized.collection_uid;
    }
    if (params.sanitized.item_uids) {
      where.itemId = {
        $in: params.sanitized.item_uids,
      };
    }

    debug('\'find\'', params, where);

    const results = await this.SequelizeService.find({
      ...params,
      where,
    });

    // console.log(results);
    const groups = {
      article: {
        service: 'articles',
        uids: [],
      },
      page: {
        service: 'pages',
        uids: [],
      },
      issue: {
        service: 'issues',
        uids: [],
      },
    };

    // collect items uids
    results.data.forEach((d) => {
      // add uid to list of uid per service.
      const contentType = d.getContentType();
      groups[contentType].uids.push(d.itemId);
    });

    // console.log(groups);
    return Promise.all(lodash(groups)
      .filter(d => d.uids.length)
      .map(d => this.app.service(d.service).get(d.uids.join(','), {
        query: {},
        user: params.user,
        findAll: true, // this makes "findall" explicit, thus forcing the result as array
      })).value()).then((values) => {
      const flattened = lodash(values).flatten().keyBy('uid').value();

      results.data = results.data.map(d => ({
        dateAdded: d.dateAdded,
        collection: d.collection,
        item: flattened[d.itemId],
      }));

      return results;
    });
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
