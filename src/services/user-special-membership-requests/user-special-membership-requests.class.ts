import { Op, type Sequelize } from 'sequelize'
import { PublicFindResponse as FindResponse } from '../../models/common'
import type { ImpressoApplication } from '../../types'
import type { ClientService, Id, Params } from '@feathersjs/feathers'
import UserSpecialMembershipRequestModel from '../../models/user-special-membership-requests.model'
import { BadRequest, NotFound } from '@feathersjs/errors'
import { SlimUser } from '../../authentication'
import SpecialMembershipAccess from '../../models/special-membership-access.model'
import { CeleryClient } from '../../celery'

export interface FindQuery {
  limit?: number
  offset?: number
}
export interface UserSpecialMembershipRequestParams<Q = FindQuery> extends Params<Q> {
  user?: {
    id: SlimUser['id']
  }
}

export type FindResult = FindResponse<UserSpecialMembershipRequestModel>
export type IUserSpecialMembershipRequestService = Omit<
  ClientService<UserSpecialMembershipRequestModel, any, any, FindResponse<UserSpecialMembershipRequestModel>>,
  'create' | 'patch' | 'remove' | 'update'
>

export class UserSpecialMembershipRequestService implements IUserSpecialMembershipRequestService {
  protected readonly sequelizeClient: Sequelize
  protected readonly celeryClient: CeleryClient
  protected readonly requestModel: ReturnType<typeof UserSpecialMembershipRequestModel.initialize>
  protected readonly accessModel: ReturnType<typeof SpecialMembershipAccess.initialize>
  public readonly name: string

  constructor(app: ImpressoApplication) {
    this.sequelizeClient = app.get('sequelizeClient') as Sequelize
    this.celeryClient = app.get('celeryClient') as CeleryClient
    this.requestModel = UserSpecialMembershipRequestModel.initialize(this.sequelizeClient)
    this.accessModel = SpecialMembershipAccess.initialize(this.sequelizeClient)
    this.name = 'user-special-membership-requests'
  }

  async find(params?: UserSpecialMembershipRequestParams): Promise<FindResult> {
    const { limit = 10, offset = 0 } = params?.query ?? {}
    const userId = params?.user?.id

    if (userId == null) {
      return { data: [], pagination: { limit, offset, total: 0 } }
    }

    const { rows, count: total } = await this.requestModel.findAndCountAll({
      limit,
      offset,
      where: { userId },
      order: [['dateLastModified', 'DESC']],
      include: ['specialMembershipAccess'],
    })

    return {
      pagination: { limit, offset, total },
      data: rows.map(row => row.toJSON() as UserSpecialMembershipRequestModel),
    }
  }

  async create(
    data: Partial<UserSpecialMembershipRequestModel> & { notes: string },
    params: { user: Partial<SlimUser> }
  ): Promise<UserSpecialMembershipRequestModel> {
    if (!data.specialMembershipAccessId) {
      throw new BadRequest('specialMembershipAccessId is required')
    }
    const now = new Date()
    const specialMembershipAccess = await this.accessModel.findByPk(data.specialMembershipAccessId!)
    if (!specialMembershipAccess) {
      throw new NotFound(`SpecialMembershipAccess with id ${data.specialMembershipAccessId} not found`)
    }
    const userRequest = await this.requestModel.create({
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
    if (this.celeryClient)
      this.celeryClient
        .run({
          task: 'impresso.tasks.after_special_membership_request_created',
          args: [userRequest.id],
        })
        .catch(err => {
          console.error('Error sending after_special_membership_request_created task:', err)
        })
    return userRequest
  }

  async get(id: Id, params?: UserSpecialMembershipRequestParams): Promise<UserSpecialMembershipRequestModel> {
    const userId = params?.user?.id
    if (userId == null) {
      throw new NotFound(`UserSpecialMembershipRequest with id ${id} not found`)
    }
    const record = await this.requestModel.findOne({
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
