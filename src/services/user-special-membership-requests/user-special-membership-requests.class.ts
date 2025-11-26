import { Op, type Sequelize } from 'sequelize'
import { PublicFindResponse as FindResponse } from '../../models/common'
import type { ImpressoApplication } from '../../types'
import type { ClientService, Id, Params } from '@feathersjs/feathers'
import UserSpecialMembershipRequest from '../../models/user-special-membership-requests.model'
import { BadRequest, NotFound } from '@feathersjs/errors'
import { SlimUser } from '../../authentication'
import SpecialMembershipAccess from '@/models/special-membership-access.model'

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
    UserSpecialMembershipRequest.associate()
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

  async create(
    data: Partial<UserSpecialMembershipRequest> & { notes: string },
    params: { user: Partial<SlimUser> }
  ): Promise<UserSpecialMembershipRequest> {
    if (!data.specialMembershipAccessId) {
      throw new BadRequest('specialMembershipAccessId is required')
    }
    const now = new Date()
    const specialMembershipAccess = await SpecialMembershipAccess.findByPk(data.specialMembershipAccessId!)
    if (!specialMembershipAccess) {
      throw new NotFound(`SpecialMembershipAccess with id ${data.specialMembershipAccessId} not found`)
    }
    const userRequest = await this.model.create({
      userId: params.user.id!,
      reviewerId: null,
      status: 'pending',
      dateCreated: now,
      dateLastModified: now,
      changelog: [
        {
          status: 'pending',
          subscription: specialMembershipAccess.title,
          date: now.toISOString(),
          reviewer: '',
          notes: data.notes,
        },
      ],
      specialMembershipAccessId: specialMembershipAccess.id,
    })
    return userRequest
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
