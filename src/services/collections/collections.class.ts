import type { ClientService, Id, NullableId, Params } from '@feathersjs/feathers'
import { FindResponse } from '../../models/common'
import type { Collection } from '../../models/generated/schemasPublic'
import { NewCollectionRequest } from '../../models/generated/shared'
import type { ImpressoApplication } from '../../types'
import { SlimUser } from '../../authentication'
import UserCollection, { IUserCollection } from '../../models/user-collection'
import { InferAttributes, Op, Sequelize, WhereOptions } from 'sequelize'
import { NotFound } from '@feathersjs/errors'

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
    uid: String(dbModel.id),
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

  constructor(app: ImpressoApplication) {
    this.app = app

    const sequelize = app.get('sequelizeClient') as Sequelize
    this.userCollectionDbModel = UserCollection.initialize(sequelize)
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
          ...(userId != null
            ? [{ id: Number(id), creatorId: userId, status: { [Op.in]: ['PRI', 'SHA', 'PUB'] } }]
            : []),
          {
            id: Number(id),
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
    throw new Error('Method not implemented.')
  }

  async patch(id: NullableId, data: CollectionsPatch, params?: CollectionsParams): Promise<Collection> {
    throw new Error('Method not implemented.')
  }

  async remove(id: NullableId, params?: CollectionsParams): Promise<Collection> {
    throw new Error('Method not implemented.')
  }

  async update(id: NullableId, data: CollectionsPatch, params?: CollectionsParams): Promise<Collection> {
    throw new Error('Method not implemented.')
  }
}
