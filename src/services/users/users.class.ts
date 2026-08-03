import { nanoid } from 'nanoid'
import { randomBytes } from 'crypto'
import { getLogger } from '@/logger.js'
import User, { type UserAttributes } from '@/models/users.model.js'
import Group from '@/models/groups.model.js'
import Profile from '@/models/profiles.model.js'
import type { ImpressoApplication } from '@/types.js'
import type { SlimUser } from '@/authentication.js'
import { BadRequest, NotFound, MethodNotAllowed } from '@feathersjs/errors'
import type { Params as FeathersParams } from '@feathersjs/feathers'
import { Op, type Sequelize } from 'sequelize'
import { sequelizeErrorHandler } from '@/services/sequelize.utils.js'
import { RedisClient } from '@/redis.js'

import { Config } from '@/models/generated/app/configuration.js'

const logger = getLogger(['impresso', 'services', 'users'])

type UserToJSON = (params?: { groups?: Group[]; userBitmap?: { bitmap?: bigint } }) => UserAttributes

interface ServiceOptions {
  app: ImpressoApplication
  name: string
}

interface AuthenticatedParams extends FeathersParams {
  user: SlimUser
}

interface GetParams extends FeathersParams {
  authenticated?: boolean
}

interface CreateFields {
  username: string
  firstname: string
  lastname: string
  displayName: string
  email: string
  password: string
  plan?: string
  affiliation?: string
  institutionalUrl?: string
  pattern?: string
}

interface CreateData extends CreateFields {
  sanitized?: CreateFields
}

interface PatchFields {
  password?: string
}

interface PatchData extends PatchFields {
  sanitized?: PatchFields
}

interface FindFields {
  githubId?: string
  email?: string
  uid?: string
}

interface FindParams extends FeathersParams {
  sanitized?: FindFields
  query?: Record<string, unknown> & FindFields
}

type UserRecord = Awaited<ReturnType<ReturnType<typeof User.sequelize>['findOne']>>

export class Service {
  readonly app: ImpressoApplication
  readonly name: string
  readonly id: string
  readonly sequelizeClient: Sequelize
  readonly sequelizeKlass: ReturnType<typeof User.sequelize>
  protected readonly magicLinkConfig: Config['magicLink']
  protected readonly redisClient: RedisClient

  constructor({ app, name }: ServiceOptions) {
    const client = app.get('sequelizeClient') as Sequelize | undefined
    if (!client) {
      throw new Error('Sequelize client not available in Users service')
    }

    this.app = app
    this.magicLinkConfig = app.get('magicLink') as { secret: string; expiration: number }
    this.redisClient = app.service('redisClient').client as RedisClient
    this.name = name
    this.id = 'id'
    this.sequelizeClient = client
    this.sequelizeKlass = User.sequelize(this.sequelizeClient)
  }

  async get(id: string, params: GetParams = {}) {
    logger.debug(`[get] id: ${id} provider: ${params.provider} authenticated: ${params.authenticated}`)

    if (!params.authenticated && params.provider) {
      throw new MethodNotAllowed('Not allowed')
    }

    const userModel = await this.lookupUser(id, 'isActive', ['groups', 'profile', 'userBitmap'])

    if (!userModel) {
      logger.debug(`[get] uid not found <uid>: ${id}`)
      throw new NotFound()
    }

    const groups = userModel.get('groups') as Group[] | undefined
    const profile = userModel.get('profile') as Profile | undefined
    const userBitmap = userModel.get('userBitmap') as { bitmap?: bigint } | undefined

    logger.debug(
      `[get] user <uid>: ${profile?.uid} <groups>: ${groups?.map(group => group.name)} <bitmap>: ${userBitmap?.bitmap}`
    )

    return (userModel.toJSON as UserToJSON)({ groups, userBitmap })
  }

  async create(data: CreateData) {
    const sanitized = data.sanitized ?? data
    const uid = `local-${nanoid(8)}`
    const newUser = {
      uid,
      firstname: sanitized.firstname,
      lastname: sanitized.lastname,
      username: sanitized.username,
      email: sanitized.email,
      password: User.buildPassword({
        password: sanitized.password,
      }),
      isActive: false,
    }

    const existingUser = await this.sequelizeKlass.findOne({
      where: {
        [Op.or]: [{ email: newUser.email }, { username: newUser.username }],
      },
    })

    if (existingUser) {
      logger.debug(`[create] user already exists: ${existingUser.get('id') as number}`)
      throw new BadRequest('User with this email address or username already exists')
    }

    logger.debug(`[create] new user: ${newUser.username}`)

    const createdUser = await this.sequelizeKlass.create(newUser as never).catch(sequelizeErrorHandler)
    const createdUserId = createdUser.get('id') as number

    logger.debug(`[create] user created! ${createdUserId}`)

    const userProfile = await Profile.create({
      uid,
      user_id: createdUserId,
      displayName: sanitized.displayName,
      provider: 'local',
      picture: '',
      emailAccepted: false,
      emailVerified: false,
      maxLoopsAllowed: 100,
      maxParallelJobs: 2,
      affiliation: sanitized.affiliation ?? '',
      institutionalUrl: sanitized.institutionalUrl ?? '',
      pattern: sanitized.pattern ?? '',
    }).catch(sequelizeErrorHandler)

    logger.debug(
      `[create] profile created! id=${userProfile.get('id')} uid=${userProfile.get('uid')} displayName=${userProfile.get('displayName')}`
    )

    const [group, created] = await Group.findOrCreate({
      where: { name: sanitized.plan ?? 'plan-basic' },
    })

    logger.debug(`[create] group ${group.name} created: ${created}`)

    await (createdUser as typeof createdUser & { addGroup: (value: Group) => Promise<unknown> }).addGroup(group)

    logger.debug(`[create] user with profile: ${uid} success for user id ${createdUserId} and group ${group.name}`)
    // Generate an opaque high-entropy token for email verification.
    const token = randomBytes(32).toString('base64url')
    const callbackUrl = this.app.get('callbackUrls')?.emailVerification

    logger.debug(
      `Generated email verification token for user ${uid} (expires in ${this.magicLinkConfig.expiration} seconds)`
    )
    // save user id related to the token into the db
    await this.redisClient.setEx(
      `user-email-verification:${token}`,
      this.magicLinkConfig.expiration,
      String(createdUserId)
    )
    await this.redisClient.setEx(
      `user-email-verification:active-by-user:${createdUserId}`,
      this.magicLinkConfig.expiration,
      token
    )

    const celeryClient = this.app.get('celeryClient')
    if (celeryClient) {
      logger.debug(`[create] inform impresso admin to activate this user: ${uid}`)
      await celeryClient
        .run({
          task: 'impresso.tasks.after_user_registered',
          args: [createdUserId, token, callbackUrl],
        })
        .catch((err: Error) => {
          logger.debug(`Error ${err}`)
        })
    }

    const createdUserJson = createdUser.toJSON() as unknown as UserAttributes

    return new User({
      id: createdUserId,
      uid,
      firstname: sanitized.firstname,
      lastname: sanitized.lastname,
      username: sanitized.username,
      email: sanitized.email,
      password: createdUserJson.password,
      isActive: Boolean(createdUserJson.isActive),
      isStaff: Boolean(createdUserJson.isStaff),
      isSuperuser: Boolean(createdUserJson.isSuperuser),
      creationDate: createdUserJson.creationDate,
      lastLogin: createdUserJson.lastLogin,
      profile: userProfile,
      groups: [group],
    })
  }

  async update(_id: string, data: unknown) {
    return data
  }

  async patch(id: string, data: PatchData, params: AuthenticatedParams) {
    const sanitized = data.sanitized ?? data

    if (sanitized.password && params.user.isStaff) {
      logger.debug(`change password requested for user:${id}`)

      const userModel = await this.lookupUser(id, 'get')
      if (!userModel) {
        throw new NotFound()
      }

      await userModel.update({
        password: User.buildPassword({
          password: sanitized.password,
        }),
      })

      return userModel.toJSON()
    }

    return {
      id,
    }
  }

  async remove(id: string, params: AuthenticatedParams) {
    if (!params.user.isStaff) {
      return { id }
    }

    const user = await this.lookupUser(id, 'get')
    if (!user) {
      return {
        id,
      }
    }

    const profile = user.get('profile') as Profile | undefined
    logger.debug(`remove: profile for ${user.get('username') as string}`)

    if (profile) {
      await profile.destroy()
    }

    logger.debug(`remove: user ${user.get('username') as string}`)

    const removedUserId = user.get('id') as number
    await user.destroy().catch(sequelizeErrorHandler)

    logger.debug(`remove: ${user.get('username') as string} success! User id ${removedUserId}`)

    return {
      removed: user,
      id,
    }
  }

  async find(params: FindParams = {}) {
    logger.debug(`[find] query: ${JSON.stringify(params.query)} provider: ${params.provider}`)

    if (params.provider) {
      throw new MethodNotAllowed('Not allowed')
    }

    const sanitized = params.sanitized ?? {
      githubId: typeof params.query?.githubId === 'string' ? params.query.githubId : undefined,
      email: typeof params.query?.email === 'string' ? params.query.email : undefined,
      uid: typeof params.query?.uid === 'string' ? params.query.uid : undefined,
    }

    let uid: string | undefined

    if (sanitized.githubId) {
      uid = `github-${sanitized.githubId}`
    } else if (sanitized.email) {
      uid = sanitized.email
    } else if (sanitized.uid) {
      uid = sanitized.uid
    }

    const sequelizeParams = uid
      ? {
          where: {
            [Op.or]: [{ email: uid }, { username: uid }, { '$profile.uid$': uid }],
          },
        }
      : undefined

    return this.sequelizeKlass
      .scope(['isActive', 'find'])
      .findAll(sequelizeParams)
      .then(records => records.map(record => new User(record.toJSON())))
  }

  private async lookupUser(
    id: string,
    scope: 'get' | 'isActive',
    include?: string[]
  ): Promise<Exclude<UserRecord, null>> {
    const parsedId = Number.parseInt(id, 10)
    const where = {
      [Op.or]: [
        { id: Number.isNaN(parsedId) ? -1 : parsedId },
        { username: String(id) },
        { '$profile.uid$': String(id) },
      ],
    }

    const userModel = await this.sequelizeKlass
      .scope(scope)
      .findAll({
        where,
        include,
      })
      .then(results => results[0] ?? null)

    return userModel as Exclude<UserRecord, null>
  }
}
