import { Op, type Sequelize } from 'sequelize'
import { PublicFindResponse as FindResponse } from '@/models/common.js'
import type { ImpressoApplication } from '@/types.js'
import type { ClientService, Id, Params } from '@feathersjs/feathers'
import SpecialMembershipAccess from '@/models/special-membership-access.model.js'
import { BadRequest, Forbidden, NotAuthenticated, NotFound } from '@feathersjs/errors'
import { SlimUser } from '@/authentication.js'
import UserSpecialMembershipRequestModel from '@/models/user-special-membership-requests.model.js'
import { Cache, WellKnownKeys } from '@/cache.js'

export interface FindQuery {
  limit?: number
  offset?: number
  bitmapPositions?: number[]
}
export type FindResult = FindResponse<SpecialMembershipAccess>
type SpecialMembershipAccessPatchData = {
  metadata?: SpecialMembershipAccess['metadata']
}

export type ISpecialMembershipPlansService = Omit<
  ClientService<SpecialMembershipAccess, any, any, FindResponse<SpecialMembershipAccess>>,
  'create' | 'patch' | 'remove' | 'update'
> & {
  patch(
    id: Id | null,
    data: SpecialMembershipAccessPatchData,
    params?: Params & { user?: SlimUser }
  ): Promise<SpecialMembershipAccess>
  getByBitmapPosition(bitmapPosition: number): Promise<SpecialMembershipAccess | undefined>
}

export class SpecialMembershipPlansService implements ISpecialMembershipPlansService {
  protected readonly sequelizeClient: Sequelize
  protected readonly accessModel: ReturnType<typeof SpecialMembershipAccess.initialize>
  protected readonly cacheManager: Cache
  constructor(app: ImpressoApplication) {
    this.sequelizeClient = app.get('sequelizeClient') as Sequelize
    this.accessModel = SpecialMembershipAccess.initialize(this.sequelizeClient)
    this.cacheManager = app.get('cacheManager')
  }

  async find(params?: { query?: FindQuery; user?: SlimUser }): Promise<FindResult> {
    const { limit = 10, offset = 0, bitmapPositions } = params?.query ?? {}
    const userId = params?.user?.id
    const where =
      Array.isArray(bitmapPositions) && bitmapPositions.length > 0
        ? {
            bitmapPosition: {
              [Op.in]: bitmapPositions,
            },
          }
        : undefined

    if (!userId || isNaN(userId)) {
      const { rows, count: total } = await this.accessModel.findAndCountAll({
        limit,
        offset,
        where,
        // include: ['requests'],
      })
      return {
        pagination: { limit, offset, total },
        data: rows.map(row => row.toJSON() as SpecialMembershipAccess),
      }
    }

    const { rows, count: total } = await this.accessModel.findAndCountAll({
      limit,
      offset,
      where,
      include: {
        model: UserSpecialMembershipRequestModel,
        as: 'requests',
        required: false,
        where: {
          userId: userId, // Move the condition here
        },
      },
    })
    return {
      pagination: { limit, offset, total },
      data: rows.map(row => row.toJSON() as SpecialMembershipAccess),
    }
  }

  async getByBitmapPosition(bitmapPosition: number): Promise<SpecialMembershipAccess | undefined> {
    const record = await this.accessModel.findOne({
      where: {
        bitmapPosition,
      },
    })
    return (record?.toJSON() as SpecialMembershipAccess | undefined) ?? undefined
  }

  async getLookup(): Promise<Record<string, SpecialMembershipAccess>> {
    try {
      const result = await this.cacheManager.get<string>(WellKnownKeys.SpecialMembershipAccessByBitmapPosition)
      return JSON.parse(result ?? '{}') as Record<string, SpecialMembershipAccess>
    } catch {
      return {}
    }
  }

  async get(id: Id, _params?: Params): Promise<SpecialMembershipAccess> {
    const record = await this.accessModel.findByPk(id)
    if (!record) {
      throw new NotFound(`SpecialMembershipAccess with id ${id} not found`)
    }
    return record
  }

  async patch(
    id: Id | null,
    data: SpecialMembershipAccessPatchData,
    params?: Params & { user?: SlimUser }
  ): Promise<SpecialMembershipAccess> {
    if (id == null) {
      throw new NotFound('SpecialMembershipAccess id is required')
    }

    const allowedKeys = ['metadata']
    const patchKeys = Object.keys(data)
    if (patchKeys.length === 0) {
      throw new BadRequest('metadata is required')
    }
    if (patchKeys.some(key => !allowedKeys.includes(key))) {
      throw new BadRequest('Only metadata can be updated')
    }

    const userId = params?.user?.id
    if (userId == null) {
      throw new NotAuthenticated('Authentication required')
    }

    const record = await this.accessModel.findByPk(id)
    if (!record) {
      throw new NotFound(`SpecialMembershipAccess with id ${id} not found`)
    }

    if (record.reviewerId !== userId) {
      throw new Forbidden('Only the reviewer of this item can update its metadata')
    }

    await record.update({ metadata: data.metadata ?? null })
    return record
  }
}
