import { Op, type Sequelize } from 'sequelize'
import { PublicFindResponse as FindResponse } from '@/models/common.js'
import type { ImpressoApplication } from '@/types.js'
import type { ClientService, Id, NullableId, Params } from '@feathersjs/feathers'
import Debug from 'debug'
import UserSpecialMembershipRequestModel, { AvailableStatuses } from '@/models/user-special-membership-requests.model.js'
import { NotFound, BadRequest } from '@feathersjs/errors'
import { SlimUser } from '@/authentication.js'
import User from '@/models/users.model.js'
import Group from '@/models/groups.model.js'
import Profile from '@/models/profiles.model.js'
import { CeleryClient } from '@/celery.js'
import { logger } from '@/logger.js'

const debug = Debug('impresso/services:user-special-membership-requests-reviews')
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
 * Service exposing reviewer-scoped access to special membership requests.
 * It allows authenticated reviewers to list and retrieve special membership
 * requests that are assigned to them or otherwise visible in their review
 * scope. The service is read-only from the client perspective and does not
 * support creating, updating, or deleting requests.
 *
 *    DEBUG=impresso/services:user-special-membership-requests-reviews npm run dev
 *
 * The exposed find/get operations return special membership requests together
 * with basic requester information (see the Requester type) to support
 * review workflows in the backoffice or other internal tools.
 *
 * @param {ImpressoApplication} app
 * @param {string} name
 * @returns {ServiceMethods}
 *
 */
export type IUserSpecialMembershipRequestReviewsService = Omit<
  ClientService<
    UserSpecialMembershipRequestModel,
    any,
    any,
    FindResponse<UserSpecialMembershipRequestModel & { requester: Requester }>
  >,
  'create' | 'remove' | 'update' | 'patch'
> & {
  // Define your strict single-item patch here
  patch(
    id: Id, // Force id to be a single Id (non-nullable)
    data: Partial<UserSpecialMembershipRequestModel>,
    params?: UserSpecialMembershipRequestParams
  ): Promise<UserSpecialMembershipRequestModel>
}

export class UserSpecialMembershipRequestReviewsService implements IUserSpecialMembershipRequestReviewsService {
  protected readonly sequelizeClient: Sequelize
  protected readonly celeryClient: CeleryClient
  protected readonly requestModel: ReturnType<typeof UserSpecialMembershipRequestModel.initialize>
  public readonly name: string

  /**
   * Constructor of the UserSpecialMembershipRequestReviewsService class
   * @param app ImpressoApplication
   */
  constructor(app: ImpressoApplication) {
    this.sequelizeClient = app.get('sequelizeClient') as Sequelize
    this.celeryClient = app.get('celeryClient') as CeleryClient
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
          bitmap: (user as any).userBitmap ? (user as any).userBitmap.get('bitmap') : undefined,
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
    const isDirectReviewer = record && record.reviewerId === reviewerId
    const isSpecialAccessReviewer =
      record &&
      (record as any).specialMembershipAccess &&
      (record as any).specialMembershipAccess.reviewerId === reviewerId

    if (!record || (!isDirectReviewer && !isSpecialAccessReviewer)) {
      throw new NotFound(`UserSpecialMembershipRequest with id ${id} not found`)
    }
    return record.toJSON() as UserSpecialMembershipRequestModel
  }

  async patch(
    id: Id,
    data: Partial<UserSpecialMembershipRequestModel>,
    params?: UserSpecialMembershipRequestParams
  ): Promise<UserSpecialMembershipRequestModel> {
    const reviewerId = params?.user?.id
    debug('Patching request %s by reviewer %s', id, reviewerId)
    if (id == null) {
      throw new NotFound('UserSpecialMembershipRequest id is required')
    }

    // Validate status field if provided
    if (data.status && !AvailableStatuses.includes(data.status)) {
      throw new BadRequest(
        `Invalid status value. Must be one of: ${AvailableStatuses.join(', ')}`
      )
    }

    const record = await this.requestModel.findByPk(id, {
      include: ['specialMembershipAccess'],
    })
    const isDirectReviewer = record && record.reviewerId === reviewerId
    const isSpecialAccessReviewer =
      record &&
      (record as any).specialMembershipAccess &&
      (record as any).specialMembershipAccess.reviewerId === reviewerId

    if (!record || (!isDirectReviewer && !isSpecialAccessReviewer)) {
      throw new NotFound(`UserSpecialMembershipRequest with id ${id} not found`)
    }

    const updateData = { ...data, dateLastModified: new Date() }
    await record.update(updateData)
    debug('Updated request %s', id)
    
    if (this.celeryClient) {
      try {
        await this.celeryClient.run({
          task: 'impresso.tasks.userSpecialMembershipRequest_tasks.after_special_membership_request_updated',
          args: [record.id],
        })
      } catch (err) {
        logger.error('Error sending after_special_membership_request_updated task:', err)
      }
    }

    return record.toJSON() as UserSpecialMembershipRequestModel
  }
}
