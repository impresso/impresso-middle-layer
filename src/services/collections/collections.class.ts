import { NotAuthenticated, NotFound } from '@feathersjs/errors'
import type { ClientService, Id, Params } from '@feathersjs/feathers'
import { InferAttributes, Op, Sequelize, WhereOptions } from 'sequelize'
import { SlimUser } from '../../authentication'
import { QueueService } from '../../internalServices/queue'
import { FindResponse } from '../../models/common'
import type { Collection } from '../../models/generated/schemasPublic'
import { NewCollectionRequest } from '../../models/generated/shared'
import UserCollection, { IUserCollection } from '../../models/user-collection'
import type { ImpressoApplication } from '../../types'

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

type ICollectionsService = Omit<
  ClientService<Collection, NewCollectionRequest, NewCollectionRequest, FindResponse<Collection>, CollectionsParams>,
  'update' | 'create' | 'remove' | 'patch'
>

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

export class CollectionsService implements ICollectionsService {
  protected readonly app: ImpressoApplication
  protected readonly userCollectionDbModel: typeof UserCollection
  protected readonly queueService: QueueService

  constructor(app: ImpressoApplication) {
    this.app = app

    const sequelize = app.get('sequelizeClient') as Sequelize
    this.userCollectionDbModel = UserCollection.initialize(sequelize)
    this.queueService = app.service('queueService')
  }

  async find(params: CollectionsParams): Promise<CollectionsFindResult> {
    const { limit = 10, offset = 0, term = '', includePublic = false } = params?.query ?? {}
    const userId = params?.user?.id

    if (userId == null) {
      return { data: [], limit, offset, total: 0 }
    }

    // Get from the DB

    const where: WhereOptions<InferAttributes<UserCollection>> = {
      creatorId: userId,
      status: { [Op.in]: includePublic ? ['PRI', 'SHA', 'PUB'] : ['PRI'] },
    }

    if (term && term.length > 0) {
      where.name = { [Op.like]: `%${term.trim()}%` }
      where.description = { [Op.like]: `%${term.trim()}%` }
    }

    const { rows, count: total } = await this.userCollectionDbModel.findAndCountAll({
      where,
      limit,
      offset,
      order: [['lastModifiedDate', 'DESC']],
    })

    // TODO: add counts from Solr

    const data = rows.map(dbToCollection)

    return {
      data,
      limit,
      offset,
      total,
    }
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

    // TODO: add count from Solr

    return collection
  }

  async create(data: NewCollectionRequest, params?: CollectionsParams): Promise<Collection> {
    const userId = params?.user?.id

    if (userId == null) {
      throw new NotAuthenticated('Authentication required')
    }

    const now = new Date()
    const status = data.accessLevel === 'public' ? 'PUB' : 'PRI'

    const dbModel = await this.userCollectionDbModel.create({
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

    await dbModel.update(updateData)

    const collection = dbToCollection(dbModel)

    // TODO: add count from Solr

    return collection
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
}
