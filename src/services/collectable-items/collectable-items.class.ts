import { NotFound } from '@feathersjs/errors'
import { NullableId, Params } from '@feathersjs/feathers'
import Debug from 'debug'
import lodash from 'lodash'
import { Op } from 'sequelize'
import CollectableItemGroup from '../../models/collectable-items-groups.model'
import { STATUS_DELETED, STATUS_PUBLIC, STATUS_SHARED } from '../../models/collections.model'
import { CollectableItemsUpdatedResponse, UpdateCollectableItems } from '../../models/generated/schemas'
import User from '../../models/users.model'
import { ImpressoApplication } from '../../types'
import { measureTime } from '../../util/instruments'
import { Service as SequelizeService } from '../sequelize.service'

const debug = Debug('impresso/services/collectable-items')

interface Sanitized<T> {
  sanitized: T
}

interface WithUser {
  user?: User
}

interface PatchQuery {
  collection_uid: string
}

interface FindQuery {
  item_uids?: string[]
  collection_uids?: string[] | string
  limit?: number
  offset?: number
  order_by?: string
  resolve?: string
}

export class Service {
  app: ImpressoApplication
  sequelizeService: SequelizeService
  constructor(app: ImpressoApplication) {
    this.app = app
    this.sequelizeService = new SequelizeService({
      app: app as any as null,
      name: 'collectable-items',
    })
  }

  async find(params: Params<FindQuery> & Sanitized<FindQuery> & WithUser) {
    // simplified where for sequelize raw queries.
    const where: Record<string, any>[] = [{ '[Op.not]': [{ 'collection.status': STATUS_DELETED }] }]

    if (params.sanitized.item_uids) {
      where.push({
        item_id: params.sanitized.item_uids,
      })
    }
    if (params.sanitized.collection_uids) {
      where.push({
        collection_id: params.sanitized.collection_uids,
      })
    }
    if (params.user?.id && params.authenticated) {
      where.push({
        '[Op.or]': [
          { 'collection.creator_id': params.user.id },
          { 'collection.status': [STATUS_PUBLIC, STATUS_SHARED] },
        ],
      })
    } else {
      where.push({ 'collection.status': [STATUS_PUBLIC, STATUS_SHARED] })
    }

    const whereReducer = (sum: any[], clause: Record<string, any>) => {
      // This should be used for sequelize Symbol operator, e.g Symbol(sequelize.operator.not)
      // Object.getOwnPropertySymbols(clause).forEach((k) => {
      //   console.log('symbol!', k, k.toString());
      //   const t = k.toString();
      //
      //   if(t === ...)
      // });
      Object.keys(clause).forEach(k => {
        if (k === '[Op.not]') {
          sum.push(`NOT (${clause[k].reduce(whereReducer, []).join(' AND ')})`)
        } else if (k === '[Op.or]') {
          sum.push(`(${clause[k].reduce(whereReducer, []).join(' OR ')})`)
        } else if (Array.isArray(clause[k])) {
          sum.push(`${k} IN ('${clause[k].join("','")}')`)
        } else {
          sum.push(`${k} = '${clause[k]}'`)
        }
      })
      return sum
    }

    const reducedWhere = where.reduce(whereReducer, []).join(' AND ')

    debug("'find' fetch with reduced where clause:", reducedWhere)
    const results: any = await Promise.all([
      measureTime(
        () =>
          this.sequelizeService.rawSelect({
            query: `
          SELECT
            JSON_ARRAYAGG(collection_id) AS collectionIds,
            MIN(collectableItem.content_type) as contentType,
            MAX(collectableItem.date_added) as latestDateAdded,
            MAX(collectableItem.item_date) as itemDate,
            item_id as itemId
          FROM
            collectable_items as collectableItem
            LEFT OUTER JOIN collections as collection
            ON collectableItem.collection_id = collection.id
          WHERE ${reducedWhere}
          GROUP BY item_id
          ORDER BY ${params.sanitized.order_by}
            LIMIT :limit OFFSET :offset`,
            replacements: {
              limit: params.query?.limit,
              offset: params.query?.offset,
            },
          }),
        'collectable-items.db.q1'
      ),
      measureTime(
        () =>
          this.sequelizeService.rawSelect({
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
        'collectable-items.db.q2'
      ),
    ]).then(rs => ({
      data: rs[0].map((d: any) => new CollectableItemGroup(d)),
      limit: params.query?.limit,
      offset: params.query?.offset,
      total: rs[1][0].total,
    }))

    debug("'find' success! n. results:", results.total, ' - where clause:', reducedWhere)
    if (!results.total) {
      return results
    }

    const resolvable: Record<string, any> = {
      collections: {
        service: 'collections',
        uids: lodash(results.data).map('collectionIds').flatten().uniq().value(),
      },
    }

    // user asked specifically to fill item data.
    if (params.sanitized.resolve === 'item') {
      // collect items uids
      results.data.forEach((d: any) => {
        // add uid to list of uid per service.
        const service = d.getService()
        if (!resolvable[service]) {
          resolvable[service] = {
            service,
            uids: [d.itemId],
          }
        } else {
          resolvable[service].uids.push(d.itemId)
        }
      })
    }

    results.toBeResolved = Object.values(resolvable)

    return results
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

  async create(data: any, params: Params & WithUser) {
    // get collection, only if it does belongs to the user
    const collection = await this.app.service('collections').get(data.sanitized.collection_uid, {
      user: params.user,
    })
    if (!collection) {
      throw new NotFound()
    }
    const items = data.sanitized.items.map((d: any) => ({
      itemId: d.uid,
      contentType: d.content_type,
      collectionId: collection.uid,
    }))
    debug('[create] with items:', items)
    const results = await this.sequelizeService.bulkCreate(items)
    const client = this.app.get('celeryClient')
    if (client) {
      client.run({
        task: 'impresso.tasks.store_collection',
        args: [
          // collection_uid
          collection.uid,
          items.map((d: any) => d.itemId),
        ],
      })
    }

    return {
      data: results.map((d: any) => d.toJSON()),
      info: {
        created: results.length,
      },
    }
  }

  async remove(id: string, params: Params & Sanitized<any> & WithUser) {
    // get collection, only if it does belongs to the user
    const collection = await this.app.service('collections').get(params.sanitized.collection_uid, {
      user: params.user,
    })
    if (!collection) {
      throw new NotFound()
    }
    const results = await this.sequelizeService.sequelizeKlass.destroy({
      where: {
        [Op.or]: params.sanitized.items.map((d: any) => ({
          itemId: d.uid,
          collectionId: params.sanitized.collection_uid,
        })),
      },
    })
    debug('[remove] item:', id, parseInt(results, 10))
    const client = this.app.get('celeryClient')
    if (client) {
      client.run({
        task: 'impresso.tasks.store_collection',
        args: [
          // collection_uid
          collection.uid,
          params.sanitized.items.map(({ uid }: { uid: string }) => uid),
          'METHOD_DEL_FROM_INDEX',
        ],
      })
    }
    return {
      params: params.sanitized,
      removed: parseInt(results, 10),
    }
  }

  /**
   * Add or remove items from a collection
   * @param id  - not used
   * @param data - data to add or remove
   * @param params - params.query.collection_uid - collection UID, params.user - user
   * @returns
   */
  async patch(
    id: NullableId,
    data: UpdateCollectableItems,
    params: Params<PatchQuery> & WithUser
  ): Promise<CollectableItemsUpdatedResponse> {
    if (id != null) throw new Error('Patch operation is not supported on a single item')
    const jobQueue = this.app.get('celeryClient')
    if (jobQueue == null) {
      throw new Error('Celery client not available')
    }

    const collectionId = params.query?.collection_uid
    if (collectionId == null) {
      throw new Error('Collection UID not provided')
    }
    const userId = params.user?.id
    if (userId == null) {
      throw new Error('User not authenticated')
    }

    jobQueue.run({
      task: 'impresso.tasks.update_collection',
      args: [collectionId, userId, data.add, data.remove],
    })

    return {
      totalAdded: data.add?.length ?? 0,
      totalRemoved: data.add?.length ?? 0,
    }
  }
}
