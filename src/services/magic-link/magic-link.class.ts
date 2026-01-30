import { AuthConfig } from '@/models/generated/common.js'
import User from '@/models/users.model.js'
import type { ImpressoApplication } from '@/types.js'
import type { Params } from '@feathersjs/feathers'
import { Sequelize } from 'sequelize'
import Debug from 'debug'
import { Unavailable, BadRequest } from '@feathersjs/errors'
import jwt from 'jsonwebtoken'
import { CeleryClient } from '@/celery.js'
import { logger } from '@/logger.js'

const debug = Debug('impresso:services:magic-link')

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
  protected readonly config: AuthConfig
  protected readonly sequelizeClient: Sequelize
  protected readonly userModel: ReturnType<typeof User.sequelize>
  protected readonly celeryClient: CeleryClient

  constructor(protected readonly app: ImpressoApplication) {
    this.config = app.get('authentication') || {}
    this.sequelizeClient = app.get('sequelizeClient') as Sequelize
    this.userModel = User.sequelize(this.sequelizeClient)
    this.celeryClient = app.get('celeryClient') as CeleryClient
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
    const token = jwt.sign({ email: data.email }, this.config.secret, {
      expiresIn: 60 * 5,
    })
    // save into the db

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
      // @todo: return verified token?
    } catch (err) {
      logger.error(err)
      throw new BadRequest('Invalid token')
    }
    return {
      result: 'ok',
    }
  }
}
