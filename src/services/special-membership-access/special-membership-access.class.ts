import type { Sequelize } from 'sequelize'
import { PublicFindResponse as FindResponse } from '@/models/common.js'
import type { ImpressoApplication } from '@/types.js'
import type { ClientService, Id, Params } from '@feathersjs/feathers'
import SpecialMembershipAccess from '@/models/special-membership-access.model.js'
import { NotFound } from '@feathersjs/errors'
import UserSpecialMembershipRequestModel from '@/models/user-special-membership-requests.model.js'
import { SlimUser } from '@/authentication.js'

export interface FindQuery {
  limit?: number
  offset?: number
}
export type FindResult = FindResponse<SpecialMembershipAccess>
export type ISpecialMembershipAccessService = Omit<
  ClientService<SpecialMembershipAccess, any, any, FindResponse<SpecialMembershipAccess>>,
  'create' | 'patch' | 'remove' | 'update'
>

export class SpecialMembershipAccessService implements ISpecialMembershipAccessService {
  protected readonly sequelizeClient: Sequelize
  protected readonly accessModel: ReturnType<typeof SpecialMembershipAccess.initialize>

  constructor(app: ImpressoApplication) {
    this.sequelizeClient = app.get('sequelizeClient') as Sequelize
    this.accessModel = SpecialMembershipAccess.initialize(this.sequelizeClient)
  }

  async find(params?: { query?: FindQuery; user?: SlimUser }): Promise<FindResult> {
    const { limit = 10, offset = 0 } = params?.query ?? {}
    const userId = params?.user?.id

    if (!userId || isNaN(userId)) {
      const { rows, count: total } = await this.accessModel.findAndCountAll({
        limit,
        offset,
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
}
