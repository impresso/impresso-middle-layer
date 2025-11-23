import { Op, type Sequelize } from 'sequelize'
import { PublicFindResponse as FindResponse } from '../../models/common'
import type { ImpressoApplication } from '../../types'
import type { ClientService, Id, Params } from '@feathersjs/feathers'
import UserSpecialMembershipRequest from '../../models/user-special-membership-requests.model'
import { NotFound } from '@feathersjs/errors'
import { SlimUser } from '../../authentication'

export interface FindQuery {
  limit?: number
  offset?: number
}
export interface UserSpecialMembershipRequestParams<Q = FindQuery> extends Params<Q> {
  user?: {
    id: SlimUser['id']
  }
}

export type FindResult = FindResponse<UserSpecialMembershipRequest>
export type IUserSpecialMembershipRequestService = Omit<
  ClientService<UserSpecialMembershipRequest, any, any, FindResponse<UserSpecialMembershipRequest>>,
  'create' | 'patch' | 'remove' | 'update'
>

export class UserSpecialMembershipRequestService implements IUserSpecialMembershipRequestService {
  protected readonly sequelizeClient: Sequelize
  protected readonly model: ReturnType<typeof UserSpecialMembershipRequest.initialize>

  constructor(app: ImpressoApplication) {
    this.sequelizeClient = app.get('sequelizeClient') as Sequelize
    this.model = UserSpecialMembershipRequest.initialize(this.sequelizeClient)
  }

  async find(params?: UserSpecialMembershipRequestParams): Promise<FindResult> {
    const { limit = 10, offset = 0 } = params?.query ?? {}
    const userId = params?.user?.id

    if (userId == null) {
      return { data: [], pagination: { limit, offset, total: 0 } }
    }

    const { rows, count: total } = await this.model.findAndCountAll({
      limit,
      offset,
      where: { userId },
      order: [['dateLastModified', 'DESC']],
      include: ['specialMembershipAccess'],
    })

    return {
      pagination: { limit, offset, total },
      data: rows.map(row => row.toJSON() as UserSpecialMembershipRequest),
    }
  }
  async get(id: Id, params?: UserSpecialMembershipRequestParams): Promise<UserSpecialMembershipRequest> {
    const userId = params?.user?.id
    if (userId == null) {
      throw new NotFound(`UserSpecialMembershipRequest with id ${id} not found`)
    }
    const record = await this.model.findOne({
      where: {
        [Op.and]: [{ id }, { userId }],
      },
      include: ['specialMembershipAccess'],
    })
    if (!record) {
      throw new NotFound(`UserSpecialMembershipRequest with id ${id} not found`)
    }
    return record
  }
}
