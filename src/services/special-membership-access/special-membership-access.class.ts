import { Op, type Sequelize } from 'sequelize'
import { PublicFindResponse as FindResponse } from '@/models/common.js'
import type { ImpressoApplication } from '@/types.js'
import type { ClientService, Id, Params } from '@feathersjs/feathers'
import SpecialMembershipAccess, { ISpecialMembershipAccessMetadata } from '@/models/special-membership-access.model.js'
import { BadRequest, Forbidden, NotAuthenticated, NotFound } from '@feathersjs/errors'
import UserSpecialMembershipRequestModel from '@/models/user-special-membership-requests.model.js'
import User from '@/models/users.model.js'
import { SlimUser } from '@/authentication.js'

export interface FindQuery {
  limit?: number
  offset?: number
  bitmapPositions?: number[]
  reviewerEmail?: string
}
export type FindResult = FindResponse<SpecialMembershipAccess>
export type ISpecialMembershipAccessService = Omit<
  ClientService<SpecialMembershipAccess, any, any, FindResponse<SpecialMembershipAccess>>,
  'create' | 'patch' | 'remove' | 'update'
>

export interface PatchData {
  metadata?: ISpecialMembershipAccessMetadata
}

export interface SpecialMembershipAccessParams extends Params {
  user?: SlimUser
}

export class SpecialMembershipAccessService implements ISpecialMembershipAccessService {
  protected readonly sequelizeClient: Sequelize
  protected readonly accessModel: ReturnType<typeof SpecialMembershipAccess.initialize>
  protected readonly userModel: ReturnType<typeof User.sequelize>

  constructor(app: ImpressoApplication) {
    this.sequelizeClient = app.get('sequelizeClient') as Sequelize
    this.accessModel = SpecialMembershipAccess.initialize(this.sequelizeClient)
    this.userModel = User.sequelize(this.sequelizeClient)
  }

  async find(params?: { query?: FindQuery; user?: SlimUser }): Promise<FindResult> {
    const { limit = 10, offset = 0, bitmapPositions, reviewerEmail } = params?.query ?? {}
    const userId = params?.user?.id
    const where: Record<string, any> = {}

    if (Array.isArray(bitmapPositions) && bitmapPositions.length > 0) {
      where.bitmapPosition = {
        [Op.in]: bitmapPositions,
      }
    }

    if (reviewerEmail) {
      const reviewer = await this.userModel.findOne({
        where: {
          email: reviewerEmail,
        },
      })

      if (!reviewer) {
        return {
          pagination: { limit, offset, total: 0 },
          data: [],
        }
      }

      where.reviewerId = reviewer.getDataValue('id') as number
    }

    const normalizedWhere = Object.keys(where).length > 0 ? where : undefined

    if (!userId || isNaN(userId)) {
      const { rows, count: total } = await this.accessModel.findAndCountAll({
        limit,
        offset,
        where: normalizedWhere,
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
      where: normalizedWhere,
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
  async get(id: Id, _params?: Params): Promise<SpecialMembershipAccess> {
    const record = await this.accessModel.findByPk(id)
    if (!record) {
      throw new NotFound(`SpecialMembershipAccess with id ${id} not found`)
    }
    return record
  }

  async patch(
    id: Id | null,
    data: PatchData,
    params?: SpecialMembershipAccessParams
  ): Promise<SpecialMembershipAccess | SpecialMembershipAccess[]> {
    if (id === null) {
      throw new BadRequest('Bulk patch is not supported')
    }

    const reviewerId = params?.user?.id

    if (reviewerId == null) {
      throw new NotAuthenticated('Authentication required')
    }

    const payloadKeys = Object.keys(data ?? {})
    const unsupportedKeys = payloadKeys.filter(key => key !== 'metadata')
    if (unsupportedKeys.length > 0) {
      throw new BadRequest('Only `metadata` can be updated')
    }

    if (data?.metadata === undefined) {
      throw new BadRequest('`metadata` is required')
    }

    if (data.metadata === null || typeof data.metadata !== 'object' || Array.isArray(data.metadata)) {
      throw new BadRequest('`metadata` must be an object')
    }

    const record = await this.accessModel.findByPk(id)
    if (!record) {
      throw new NotFound(`SpecialMembershipAccess with id ${id} not found`)
    }

    if (record.reviewerId !== reviewerId) {
      throw new Forbidden('Only the assigned reviewer can update this record')
    }

    await record.update({ metadata: data.metadata })

    return record.toJSON() as SpecialMembershipAccess
  }
}
