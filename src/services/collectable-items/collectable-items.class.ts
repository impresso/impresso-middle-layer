import { NotFound } from '@feathersjs/errors'
import { NullableId, Params } from '@feathersjs/feathers'
import initDebug from 'debug'
import { Op } from 'sequelize'
import CollectableItemGroup from '../../models/collectable-items-groups.model'
import { STATUS_DELETED, STATUS_PUBLIC, STATUS_SHARED } from '../../models/collections.model'
import { CollectableItemsUpdatedResponse, UpdateCollectableItemsRequest } from '../../models/generated/shared'
import User from '../../models/users.model'
import { ImpressoApplication } from '../../types'
import { measureTime } from '../../util/instruments'
import { Service as SequelizeService } from '../sequelize.service'

const debug = initDebug('impresso/services/collectable-items')

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
    const whereClauses = ['collection.status != :statusDeleted']
    const replacements: Record<string, any> = {
      statusDeleted: STATUS_DELETED,
    }
    // Handle filters
    if (Array.isArray(params.sanitized.item_uids) && params.sanitized.item_uids.length) {
      whereClauses.push(`item_id IN (:itemUids)`)
      replacements.itemUids = params.sanitized.item_uids
    }
    if (Array.isArray(params.sanitized.collection_uids) && params.sanitized.collection_uids.length) {
      whereClauses.push(`collection_id IN (:collectionUids)`)
      replacements.collectionUids = params.sanitized.collection_uids
    }
    // User authentication logic
    if (params.user?.id && params.authenticated) {
      whereClauses.push(`(collection.creator_id = :userId OR collection.status IN (:publicStatuses))`)
      replacements.userId = params.user.id
      replacements.publicStatuses = [STATUS_PUBLIC, STATUS_SHARED]
    } else {
      whereClauses.push(`collection.status IN (:publicStatuses)`)
      replacements.publicStatuses = [STATUS_PUBLIC, STATUS_SHARED]
    }

    const whereString = whereClauses.join(' AND ')

    debug('[find] fetch with WHERE clause:', whereString, replacements)

    const [dataResults, totalResults] = await Promise.all([
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
              WHERE ${whereString}
              GROUP BY item_id
              ORDER BY ${params.sanitized.order_by}
                LIMIT :limit OFFSET :offset`,
            replacements: {
              limit: params.query?.limit,
              offset: params.query?.offset,
              ...replacements,
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
              WHERE ${whereString}
              GROUP BY item_id) as gps`,
            replacements,
          }),
        'collectable-items.db.q2'
      ),
    ])

    const results = {
      data: dataResults.map((d: any) => new CollectableItemGroup(d)),
      limit: params.query?.limit || 10,
      offset: params.query?.offset || 0,
      total: totalResults?.[0]?.['total'] ?? 0,
    }

    debug('[find] success! n. results:', results.total)
    if (!results.total) return results

    const collectionIds = Array.from(new Set(results.data.flatMap((d: any) => d.collectionIds)))
    debug('[find] collectionIds:', collectionIds)

    const collections = await this.app
      .service('collections')
      .findInternal({
        user: params.user,
        query: {
          uids: collectionIds,
        },
      })
      .then((res: any) => res.data)
    debug('[find] collections:', collections)
    if (!collections) {
      return results
    }
    debug('[find] results:', results.data)
    const collectionsById = collections.reduce((acc: Record<string, any>, d: any) => {
      acc[d.uid] = d
      return acc
    }, {})
    // distribute collections to CollectableItemGroup
    results.data.map((d: CollectableItemGroup) => {
      d.collections = d.collectionIds.map((id: string) => {
        const collection = collectionsById[id]
        delete collection.creator
        return collection
      })
      return d
    })
    return results
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

    const itemIds = items.map((d: any) => d.itemId)

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

    const queueService = this.app.service('queueService')

    if (itemIds.length > 0) {
      await queueService.addItemsToCollection({
        userId: params.user?.id as any as string,
        collectionId: collection.uid,
        itemIds: itemIds,
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

    const queueService = this.app.service('queueService')
    await queueService.removeAllCollectionItems({
      userId: params.user?.id as any as string,
      collectionId: collection.uid,
    })

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
    data: UpdateCollectableItemsRequest,
    params: Params<PatchQuery> & WithUser
  ): Promise<CollectableItemsUpdatedResponse> {
    if (id != null) throw new Error('Patch operation is not supported on a single item')

    /** Old code: to be removed */
    const jobQueue = this.app.get('celeryClient')
    if (jobQueue == null) {
      throw new Error('Celery client not available')
    }
    /** End Old code: to be removed */

    const collectionId = params.query?.collection_uid
    if (collectionId == null) {
      throw new Error('Collection UID not provided')
    }
    const userId = params.user?.id as any as string
    if (userId == null) {
      throw new Error('User not authenticated')
    }

    /** Old code: to be removed */
    jobQueue.run({
      task: 'impresso.tasks.update_collection',
      args: [collectionId, userId, data.add, data.remove],
    })
    /** End Old code: to be removed */

    const queueService = this.app.service('queueService')

    if (data.add != null && data.add.length > 0) {
      await queueService.addItemsToCollection({
        userId: userId,
        collectionId: collectionId,
        itemIds: data.add,
      })
    }
    if (data.remove != null && data.remove.length > 0) {
      await queueService.removeItemsFromCollection({
        userId: userId,
        collectionId: collectionId,
        itemIds: data.remove,
      })
    }

    return {
      totalAdded: data.add?.length ?? 0,
      totalRemoved: data.add?.length ?? 0,
    }
  }
}
