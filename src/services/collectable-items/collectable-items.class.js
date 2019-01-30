/* eslint-disable no-unused-vars */
const lodash = require('lodash');
const debug = require('debug')('impresso/services/collectable-items');
const { NotFound } = require('@feathersjs/errors');

const SequelizeService = require('../sequelize.service');
const CollectableItemGroup = require('../../models/collectable-items-groups.model');


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
    // simplified where for sequelize raw queries.
    const where = [];

    if (params.sanitized.item_uids) {
      where.push({
        item_id: params.sanitized.item_uids,
      });
    }
    if (params.user.id && params.authenticated) {
      where.push({
        $or: [
          { 'collection.creator_id': params.user.id },
          { 'collection.status': ['PUB', 'SHA'] },
        ],
      });
    } else {
      where.push({ 'collection.status': ['PUB', 'SHA'] });
    }

    const whereReducer = (sum, clause) => {
      Object.keys(clause).forEach((k) => {
        if (k === '$or') {
          sum.push(`(${clause[k].reduce(whereReducer, []).join(' OR ')})`);
        } else if (Array.isArray(clause[k])) {
          sum.push(`${k} IN ('${clause[k].join('\',\'')}')`);
        } else {
          sum.push(`${k} = '${clause[k]}'`);
        }
      });
      return sum;
    };

    const reducedWhere = where.reduce(whereReducer, []).join(' AND ');

    debug('\'find\' fetch with reduced where clause:', reducedWhere);
    const results = await Promise.all([
      this.SequelizeService.rawSelect({
        query: `
          SELECT
            JSON_ARRAYAGG(collection_id) AS collectionIds,
            MIN(collectableItem.content_type) as contentType,
            MAX(collectableItem.date_added) as latestDateAdded,
            item_id as itemId
          FROM
            collectable_items as collectableItem
            LEFT OUTER JOIN collections as collection
            ON collectableItem.collection_id = collection.id
          WHERE ${reducedWhere}
          GROUP BY item_id
            LIMIT :limit OFFSET :skip`,
        replacements: {
          limit: params.query.limit,
          skip: params.query.skip,
        },
      }),
      this.SequelizeService.rawSelect({
        query: `
          SELECT count(*) as total FROM (
          SELECT
            COUNT(*) as group_count
          FROM
            collectable_items as collectableItem
            LEFT OUTER JOIN collections as collection
            ON collectableItem.collection_id = collection.id
          WHERE ${reducedWhere}
          GROUP BY item_id) as gps`,
      }),
    ]).then(rs => ({
      data: rs[0].map(d => new CollectableItemGroup(d)),
      limit: params.query.limit,
      skip: params.query.skip,
      total: rs[1][0].total,
    }));

    debug('\'find\' success! n. results:', results.total, ' - where clause:', reducedWhere);
    if (!results.total) {
      return results;
    }

    const resolvable = {
      collections: {
        service: 'collections',
        uids: lodash(results.data).map('collectionIds').flatten().uniq()
          .value(),
      },
    };

    // user asked specifically to fill item data.
    if (params.sanitized.resolve === 'item') {
      // collect items uids
      results.data.forEach((d) => {
        // add uid to list of uid per service.
        const service = d.getService();
        if (!resolvable[service]) {
          resolvable[service] = {
            service,
            uids: [d.itemId],
          };
        } else {
          resolvable[service].uids.push(d.itemId);
        }
      });
    }

    results.toBeResolved = Object.values(resolvable);

    return results;
    // // console.log(results);
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
    // results.data.forEach((d) => {
    //   // add uid to list of uid per service.
    //   const contentType = d.getContentType();
    //   groups[contentType].uids.push(d.itemId);
    // });
    //
    // // console.log(groups);
    // return Promise.all(lodash(groups)
    //   .filter(d => d.uids.length)
    //   .map(d => this.app.service(d.service).get(d.uids.join(','), {
    //     query: {},
    //     user: params.user,
    //     findAll: true, // this makes "findall" explicit, thus forcing the result as array
    //   })).value()).then((values) => {
    //   const flattened = lodash(values).flatten().keyBy('uid').value();
    //
    //   results.data = results.data.map(d => ({
    //     dateAdded: d.dateAdded,
    //     collection: d.collection,
    //     item: flattened[d.itemId],
    //   }));
    //
    //   return results;
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
