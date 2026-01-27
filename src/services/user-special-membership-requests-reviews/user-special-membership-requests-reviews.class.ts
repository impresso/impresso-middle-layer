import { Op, type Sequelize } from 'sequelize'
import { PublicFindResponse as FindResponse } from '@/models/common.js'
import type { ImpressoApplication } from '@/types.js'
import type { ClientService, Id, Params } from '@feathersjs/feathers'
import Debug from 'debug'
import UserSpecialMembershipRequestModel from '@/models/user-special-membership-requests.model.js'
import { NotFound } from '@feathersjs/errors'
import { SlimUser } from '@/authentication.js'
import User, { Me } from '@/models/users.model.js'
import Group from '@/models/groups.model.js'
import Profile from '@/models/profiles.model.js'

const debug = Debug('impresso/services:user-special-membership-requests-reviews')
debug('Loading user-special-membership-requests-reviews service')
export interface FindQuery {
  limit?: number
  offset?: number
  status?: string[]
}
export interface UserSpecialMembershipRequestParams<Q = FindQuery> extends Params<Q> {
  user?: {
    id: SlimUser['id']
  }
}

export type Requester = {
  id: number
  email: string
  firstname: string
  lastname: string
  groups?: Group[]
  profile?: Profile
  bitmap?: string
}

export interface ServiceOptions {
  app: ImpressoApplication
  name: string
}
/**
 * Service to retrieve account details,
 * e.g. latest terms of use acceptance date, list of subscription, user bitmap.
 *
 *    DEBUG=impresso/services:user-special-membership-requests-reviews npm run dev
 *
 * Test
 *
 * This service return a userBitmap object with the date the user accepted the terms of use.
 * /account-details find() method, it uses the authenticated user id from hook to find the user bitmap record.
 * /account-details patch() method, for the moment being, this just updates the dateAcceptedTerms field in the user bitmap record.
 * Subscription need to be validated by admin users, so they arent part of this service.
 *
 * @param {ImpressoApplication} app
 * @param {string} name
 * @returns {ServiceMethods}
 *
 *
 */
export type IUserSpecialMembershipRequestReviewsService = Omit<
  ClientService<
    UserSpecialMembershipRequestModel,
    any,
    any,
    FindResponse<UserSpecialMembershipRequestModel & { requester: Requester }>
  >,
  'create' | 'patch' | 'remove' | 'update'
>

export class UserSpecialMembershipRequestReviewsService implements IUserSpecialMembershipRequestReviewsService {
  protected readonly sequelizeClient: Sequelize
  protected readonly requestModel: ReturnType<typeof UserSpecialMembershipRequestModel.initialize>
  public readonly name: string

  /**
   * Constructor of the UserSpecialMembershipRequestReviewsService class
   * @param app ImpressoApplication
   */
  constructor(app: ImpressoApplication) {
    this.sequelizeClient = app.get('sequelizeClient') as Sequelize
    this.requestModel = UserSpecialMembershipRequestModel.initialize(this.sequelizeClient)
    this.name = 'user-special-membership-requests-reviews'
    debug('Initialized service %s', this.name)
  }

  async find(params?: UserSpecialMembershipRequestParams) {
    const { limit = 10, offset = 0 } = params?.query ?? {}
    const reviewerId = params?.user?.id
    debug('Finding requests for reviewerId %s', reviewerId)

    if (reviewerId == null) {
      return { data: [], pagination: { limit, offset, total: 0 } }
    }
    const { count: total, rows } = await this.requestModel.findAndCountAll({
      limit,
      offset,
      where: {
        [Op.or]: [{ reviewerId: reviewerId }, { '$specialMembershipAccess.reviewer_id$': reviewerId }],
        ...(params?.query?.status ? { status: { [Op.in]: params.query.status } } : {}),
      },
      order: [['dateLastModified', 'DESC']],
      include: ['specialMembershipAccess'],
    })

    // get subscribers basic info
    debug('Found %d requests for reviewerId %s', total, reviewerId)
    const userIds = [...new Set(rows.map(row => row.userId))]

    const users = await User.sequelize(this.sequelizeClient).findAll({
      where: {
        id: {
          [Op.in]: userIds,
        },
      },
      include: ['groups', 'profile', 'userBitmap'],
    })
    // perfect! now join the user info into the requests
    const requesterMap = users.reduce(
      (acc, user) => {
        debug('Mapping user id %d', user.get('id'))
        acc[user.get('id') as number] = {
          id: user.get('id') as number,
          email: user.get('email') as string,
          firstname: user.get('firstname') as string,
          lastname: user.get('lastname') as string,
          groups: (user as any).groups?.map((d: Group) => d.toJSON()),
          profile: (user as any).profile,
        }
        return acc
      },
      {} as Record<number, Requester>
    )
    return {
      pagination: { limit, offset, total },
      data: rows.map(row => {
        return {
          ...row.toJSON(),
          requester: requesterMap[row.userId],
        } as UserSpecialMembershipRequestModel & { requester: Requester }
      }),
    }
  }

  async get(id: Id, params?: UserSpecialMembershipRequestParams): Promise<UserSpecialMembershipRequestModel> {
    const reviewerId = params?.user?.id

    const record = await this.requestModel.findByPk(id, {
      include: ['specialMembershipAccess'],
    })
    if (!record || record.reviewerId !== reviewerId) {
      throw new NotFound(`UserSpecialMembershipRequest with id ${id} not found`)
    }
    return record.toJSON() as UserSpecialMembershipRequestModel
  }
}
