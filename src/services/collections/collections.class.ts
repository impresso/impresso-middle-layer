import { NotAuthenticated, NotFound } from '@feathersjs/errors'
import type { ClientService, Id, Params } from '@feathersjs/feathers'
import { InferAttributes, Op, Sequelize, WhereOptions } from 'sequelize'
import { SlimUser } from '@/authentication.js'
import { QueueService } from '@/internalServices/queue.js'
import { PublicFindResponse as FindResponse } from '@/models/common.js'
import type { Collection } from '@/models/generated/schemasPublic.js'
import { NewCollectionRequest } from '@/models/generated/shared.js'
import UserCollection, { IUserCollection } from '@/models/user-collection.js'
import type { ImpressoApplication } from '@/types.js'
import { SimpleSolrClient } from '@/internalServices/simpleSolr.js'
import { SolrNamespaces } from '@/solr.js'
import {
  CollectionIdPair,
  CollectionsByContentItemIdBucket,
  queryGetCollectionsByContentItems,
  queryGetItemsCountsForCollections,
  toPair,
} from '@/solr/queries/collections.js'
import { createCollectionId } from '@/models/collections.model.js'

export type CollectionsPatch = Partial<Omit<Collection, 'uid'>>
export type CollectionsFindResult = FindResponse<Collection>

export interface CollectionsQuery {
  term?: string
  limit?: number
  offset?: number
  includePublic?: boolean
}

export interface CollectionsParams<Q = CollectionsQuery> extends Params<Q> {
  user?: SlimUser
}

export type ICollectionsService = Omit<
  ClientService<Collection, NewCollectionRequest, NewCollectionRequest, FindResponse<Collection>, CollectionsParams>,
  'update' | 'create' | 'remove' | 'patch'
> & {
  create(data: NewCollectionRequest, params?: CollectionsParams): Promise<Collection>
  patch(id: Id, data: CollectionsPatch, params?: CollectionsParams): Promise<Collection>
  remove(id: Id, params?: CollectionsParams): Promise<Collection>

  findByContentItems(
    contentItemsIds: string[],
    includePublic?: boolean,
    user?: SlimUser
  ): Promise<Record<string, Collection[]>>

  getInternal(id: Id, userId?: Id): Promise<IUserCollection | undefined>
}

const dbToCollection = (dbModel: IUserCollection): Collection => {
  if (dbModel.status === 'DEL') throw new Error('Cannot convert deleted collection')
  return {
    uid: dbModel.id,
    title: dbModel.name,
    description: dbModel.description ?? '',
    accessLevel: dbModel.status === 'PRI' ? 'private' : 'public',
    createdAt: dbModel.creationDate.toISOString(),
    updatedAt: dbModel.lastModifiedDate.toISOString(),
  }
}

interface CollectionIdPairWithCount extends CollectionIdPair {
  count: number
}

export class CollectionsService implements ICollectionsService {
  protected readonly userCollectionDbModel: typeof UserCollection
  protected readonly queueService: QueueService
  protected readonly solrClient: SimpleSolrClient

  constructor(app: ImpressoApplication) {
    const sequelize = app.get('sequelizeClient') as Sequelize
    this.userCollectionDbModel = UserCollection.initialize(sequelize)
    this.queueService = app.service('queueService')
    this.solrClient = app.service('simpleSolrClient')
  }

  async _getCollectionsItemsCount(pairs: CollectionIdPair[]): Promise<CollectionIdPairWithCount[]> {
    const body = queryGetItemsCountsForCollections(pairs)
    const response = await this.solrClient.select<unknown, 'collections'>(SolrNamespaces.CollectionItems, {
      body,
    })

    return (
      response.facets?.collections?.buckets?.map(({ val, count }) => {
        const { userId, collectionId } = toPair(String(val))
        return { userId, collectionId, count: count ?? 0 } satisfies CollectionIdPairWithCount
      }) ?? []
    )
  }

  async find(params: CollectionsParams): Promise<CollectionsFindResult> {
    const { limit = 10, offset = 0, term = '', includePublic = false } = params?.query ?? {}
    const userId = params?.user?.id

    if (userId == null) {
      return { data: [], pagination: { limit, offset, total: 0 } }
    }

    // Get from the DB
    const whereContainTerms: WhereOptions<InferAttributes<UserCollection>> | null =
      term && term.length > 0
        ? {
            [Op.or]: [{ name: { [Op.like]: `%${term.trim()}%` } }, { description: { [Op.like]: `%${term.trim()}%` } }],
          }
        : null

    const whereIsCreator: WhereOptions<InferAttributes<UserCollection>> = {
      [Op.and]: [
        {
          creatorId: userId,
        },
        {
          status: { [Op.in]: includePublic ? ['PRI', 'SHA', 'PUB'] : ['PRI'] },
        },
      ],
    }

    const where = {
      ...(whereContainTerms ? whereContainTerms : {}),
      ...whereIsCreator,
    }

    const { rows, count: total } = await this.userCollectionDbModel.findAndCountAll({
      where,
      limit,
      offset,
      order: [['lastModifiedDate', 'DESC']],
    })

    // Get collection counts from Solr
    const collectionPairs: CollectionIdPair[] = rows.map(row => ({
      userId: String(userId),
      collectionId: String(row.id),
    }))

    const countsWithPairs = await this._getCollectionsItemsCount(collectionPairs)
    const countsMap = new Map(countsWithPairs.map(item => [item.collectionId, item.count]))

    const data = rows.map(row => ({
      ...dbToCollection(row),
      totalItems: countsMap.get(String(row.id)) ?? 0,
    }))

    return {
      data,
      pagination: { limit, offset, total },
    }
  }

  /**
   * Internal method to get any non-deleted collection by ID.
   * Does not check ownership or access level.
   * Does not return totalItems count.
   */
  async getInternal(id: Id, userId?: Id): Promise<IUserCollection | undefined> {
    const dbModel = await this.userCollectionDbModel.findOne({
      where: {
        id,
        status: { [Op.ne]: 'DEL' },
        ...(userId != null ? { creatorId: userId } : {}),
      },
    })
    return dbModel ?? undefined
  }

  async get(id: Id, params: CollectionsParams): Promise<Collection> {
    const userId = params.user?.id

    const dbModel = await this.userCollectionDbModel.findOne({
      where: {
        [Op.or]: [
          ...(userId != null ? [{ id, creatorId: userId, status: { [Op.in]: ['PRI', 'SHA', 'PUB'] } }] : []),
          {
            id,
            status: { [Op.in]: ['SHA', 'PUB'] },
          },
        ],
      },
    })

    if (!dbModel) {
      throw new NotFound('Collection not found')
    }

    const collection = dbToCollection(dbModel)

    // Get collection count from Solr
    const collectionPairs: CollectionIdPair[] = [
      {
        userId: String(dbModel.creatorId),
        collectionId: String(dbModel.id),
      },
    ]

    const countsWithPairs = await this._getCollectionsItemsCount(collectionPairs)
    const totalItems = countsWithPairs[0]?.count ?? 0

    return { ...collection, totalItems }
  }

  async create(data: NewCollectionRequest, params?: CollectionsParams): Promise<Collection> {
    const userId = params?.user?.id

    if (userId == null) {
      throw new NotAuthenticated('Authentication required')
    }

    const now = new Date()
    const status = data.accessLevel === 'public' ? 'PUB' : 'PRI'

    const dbModel = await this.userCollectionDbModel.create({
      id: createCollectionId(params?.user?.uid!),
      name: data.name,
      description: data.description || '',
      creatorId: userId,
      status,
      creationDate: now,
      lastModifiedDate: now,
    })

    return { ...dbToCollection(dbModel), totalItems: 0 }
  }

  async patch(id: Id, data: CollectionsPatch, params?: CollectionsParams): Promise<Collection> {
    const userId = params?.user?.id

    if (userId == null) {
      throw new NotAuthenticated('Authentication required')
    }

    const dbModel = await this.userCollectionDbModel.findOne({
      where: {
        id,
        creatorId: userId,
        status: { [Op.in]: ['PRI', 'SHA', 'PUB'] },
      },
    })

    if (!dbModel) {
      throw new NotFound('Collection not found')
    }

    const updateData: Partial<IUserCollection> = {
      lastModifiedDate: new Date(),
    }

    if (data.title !== undefined) {
      updateData.name = data.title
    }

    if (data.description !== undefined) {
      updateData.description = data.description
    }

    if (data.accessLevel !== undefined) {
      updateData.status = data.accessLevel === 'public' ? 'PUB' : 'PRI'
    }

    // TODO: publish a job to update all items in the collection if accessLevel changed

    await dbModel.update(updateData)

    const collection = dbToCollection(dbModel)

    // Get collection count from Solr
    const collectionPairs: CollectionIdPair[] = [
      {
        userId: String(dbModel.creatorId),
        collectionId: String(dbModel.id),
      },
    ]

    const countsWithPairs = await this._getCollectionsItemsCount(collectionPairs)
    const totalItems = countsWithPairs[0]?.count ?? 0

    return { ...collection, totalItems }
  }

  async remove(id: Id, params?: CollectionsParams): Promise<Collection> {
    const userId = params?.user?.id

    if (userId == null) {
      throw new NotAuthenticated('Authentication required')
    }

    const dbModel = await this.userCollectionDbModel.findOne({
      where: {
        id,
        creatorId: userId,
        status: { [Op.in]: ['PRI', 'SHA', 'PUB'] },
      },
    })

    if (!dbModel) {
      throw new NotFound('Collection not found')
    }

    const collection = dbToCollection(dbModel)

    await dbModel.update({
      status: 'DEL',
      lastModifiedDate: new Date(),
    })

    await this.queueService.removeAllCollectionItems({
      collectionId: String(id),
      userId: String(userId),
    })

    return collection
  }

  async findByContentItems(
    contentItemsIds: string[],
    includePublic?: boolean,
    user?: SlimUser
  ): Promise<Record<string, Collection[]>> {
    const body = queryGetCollectionsByContentItems(
      contentItemsIds,
      includePublic ?? false,
      user?.id ? String(user.id) : undefined
    )
    const response = await this.solrClient.select<unknown, 'contentItemIds', CollectionsByContentItemIdBucket>(
      SolrNamespaces.CollectionItems,
      {
        body,
      }
    )

    const contentItemIdsBuckets = response.facets?.contentItemIds?.buckets ?? []

    const collectionsWithCounts =
      contentItemIdsBuckets.map(({ val, collections }) => {
        const contentItemId = String(val)

        const collectionsWithCounts =
          collections.buckets?.map(({ val, count }) => {
            const { userId, collectionId } = toPair(String(val))
            return { userId, collectionId, count: count ?? 0 } satisfies CollectionIdPairWithCount
          }) ?? []

        return [contentItemId, collectionsWithCounts] as const
      }) ?? []
    // const collectionsByContentItemId = new Map(collectionsWithCounts)
    const collectionIds = new Set(
      collectionsWithCounts.map(([_, collections]) => collections.map(c => c.collectionId)).flat()
    )

    const rows = await this.userCollectionDbModel.findAll({
      where: {
        id: {
          [Op.in]: [...collectionIds],
        },
        status: { [Op.notIn]: ['DEL'] },
      },
      order: [['lastModifiedDate', 'DESC']],
    })

    const collectionLookup = new Map(rows.map(row => [String(row.id), row]))

    const items = collectionsWithCounts.map(([contentItemId, counts]) => {
      const collections = counts
        .map(({ collectionId, count }) => {
          const dbModel = collectionLookup.get(collectionId)
          if (!dbModel) return null
          return {
            ...dbToCollection(dbModel),
            totalItems: count,
          }
        })
        .filter(c => c !== null)
      return [contentItemId, collections] as const
    })

    return Object.fromEntries(items) satisfies Record<string, Collection[]>
  }
}
