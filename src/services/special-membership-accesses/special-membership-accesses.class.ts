import type { Sequelize } from 'sequelize'
import { PublicFindResponse as FindResponse } from '@/models/common.js'
import type { ImpressoApplication } from '@/types.js'
import type { ClientService, Id, Params } from '@feathersjs/feathers'
import SpecialMembershipAccess from '@/models/special-membership-access.model.js'
import { NotFound } from '@feathersjs/errors'

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
  protected readonly model: ReturnType<typeof SpecialMembershipAccess.initialize>

  constructor(app: ImpressoApplication) {
    this.sequelizeClient = app.get('sequelizeClient') as Sequelize
    this.model = SpecialMembershipAccess.initialize(this.sequelizeClient)
  }

  async find(params?: { query?: FindQuery }): Promise<FindResult> {
    const { limit = 10, offset = 0 } = params?.query ?? {}
    const { rows, count: total } = await this.model.findAndCountAll({
      limit,
      offset,
    })

    return {
      pagination: { limit, offset, total },
      data: rows.map(row => row.toJSON() as SpecialMembershipAccess),
    }
  }
  async get(id: Id, _params?: Params): Promise<SpecialMembershipAccess> {
    const record = await this.model.findByPk(id)
    if (!record) {
      throw new NotFound(`SpecialMembershipAccess with id ${id} not found`)
    }
    return record
  }
}
