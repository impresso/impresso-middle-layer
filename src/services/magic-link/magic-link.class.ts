import { Config } from '@/models/generated/common.js'
import User from '@/models/users.model.js'
import type { ImpressoApplication } from '@/types.js'
import type { Params } from '@feathersjs/feathers'
import { Sequelize } from 'sequelize'
import Debug from 'debug'
import { Unavailable, BadRequest } from '@feathersjs/errors'
import jwt from 'jsonwebtoken'
import { CeleryClient } from '@/celery.js'
import { RedisClient } from '@/redis.js'
import { logger } from '@/logger.js'
import { randomUUID } from 'crypto'

const debug = Debug('impresso/services:magic-link')

export interface CreateData {
  email: string
}

export interface CreateResult {
  result: string
}

/**
 * Service for managing magic link authentication flows.
 *
 * Handles the creation and validation of temporary authentication tokens
 * that are sent to users via email for passwordless authentication.
 *
 * @remarks
 * - Tokens are generated using JWT with a 5-minute expiration window
 * - Requires Celery client for asynchronous email delivery
 * - User must be active and exist in the database to receive a magic link
 *
 * @throws {Unavailable} If email service (Celery) is not configured
 * @throws {Unavailable} If email delivery fails during token creation
 */
export class MagicLinkService {
  protected readonly config: Config['magicLink']
  protected readonly sequelizeClient: Sequelize
  protected readonly userModel: ReturnType<typeof User.sequelize>
  protected readonly celeryClient: CeleryClient
  protected readonly redisClient: RedisClient
  public readonly name: string

  constructor(protected readonly app: ImpressoApplication) {
    this.config = app.get('magicLink')
    this.sequelizeClient = app.get('sequelizeClient') as Sequelize
    this.userModel = User.sequelize(this.sequelizeClient)
    this.celeryClient = app.get('celeryClient') as CeleryClient
    this.redisClient = app.service('redisClient').client as RedisClient
    this.name = 'magicLink'
    debug('Initialized service %s', this.name)
  }

  /**
   *
   * @param data
   * @param _params
   * @returns
   */
  async create(data: CreateData, _params?: Params): Promise<CreateResult> {
    // generate temporary token and send email.
    // save token to redisdb with expiration time.
    const user = await this.userModel.scope('isActive').findOne({
      where: {
        email: data.email,
      },
    })
    if (!user) {
      debug('[create] User not found <email>:', data.email)
      debug('[get] uid not found <uid>:', data.email)
      return {
        result: 'ok',
      }
    }
    // Generate a unique token for the user's password reset request, this is not our JWT for auth
    const token = jwt.sign({ rand: randomUUID() }, this.config.secret, {
      expiresIn: this.config.expiration,
    })
    // save user id related to the token into the db
    await this.redisClient.setEx(`magic-link:${token}`, this.config.expiration, String(user.get('id')))
    debug('[create] Generated magic link token for email:', data.email, 'userId:', user.get('id'))
    if (!this.celeryClient) {
      debug('[create] No celery client configured, cannot send email to', data.email)
      logger.error('Email service not configured')
      throw new Unavailable('Email service not configured')
    }
    await this.celeryClient
      .run({
        task: 'impresso.tasks.send_magic_link_email',
        args: [
          // user email
          user.get('id'),
          // token
          token,
        ],
      })
      .catch((err: Error) => {
        debug('[create] Error sending magic link email to', data.email, 'error:', err)
        logger.error('Failed to send magic link email to', data.email, 'error:', err)
        throw new Unavailable('Failed to send email')
      })

    return {
      result: 'ok',
    }
  }

  async get(token: string): Promise<CreateResult> {
    debug('[get] Verifying magic link token:', token)

    if (!token || typeof token !== 'string' || token.split('.').length !== 3) {
      throw new BadRequest('Invalid token format')
    }
    try {
      const decoded = jwt.verify(token, this.config.secret)
      debug('[get] Decoded token:', decoded)
      // check if token exists in redis and get value (user id) associated with the token
      const userIdStr = await this.redisClient.get(`magic-link:${token}`)
      if (!userIdStr) {
        debug('[get] Token has no associated user id in redis:', token)
        throw new BadRequest('Invalid token')
      }
      const userId = Number(userIdStr)
      debug('[get] Retrieved user id from token:', userId)
      // delete the token after use
      await this.redisClient.del(`magic-link:${token}`)
      debug('[get] Token valid, deleted from redis:', token)
    } catch (err) {
      logger.error(err)
      throw new BadRequest('Invalid token')
    }
    return {
      result: 'ok',
    }
  }
}
