import jwt from 'jsonwebtoken'
import { Config } from '@/models/generated/app/configuration.js'
import { RedisClient } from '@/redis.js'
import { ImpressoApplication } from '@/types.js'
import { getLogger } from '@/logger.js'
import { BadRequest } from '@feathersjs/errors'
import { Params } from '@feathersjs/feathers'
import { Sequelize } from 'sequelize'
import Profile from '@/models/profiles.model.js'

const logger = getLogger(['impresso', 'services', 'user-email-verification'])

/**
 * Service for managing user email validation flows.
 *
 * Handles the validation of user email addresses by verifying tokens
 * that are sent to users via email for account activation or email change.
 *
 * See also: {@link UserService} for token generation and email delivery.
 * @remarks
 * - Tokens are generated using JWT with a 5-minute expiration window
 *
 */
export class UserEmailVerificationService {
  protected readonly magicLinkConfig: Config['magicLink']
  protected readonly redisClient: RedisClient
  protected readonly sequelizeClient: Sequelize
  public readonly name: string
  protected readonly profileModel: ReturnType<typeof Profile.initModel>

  constructor(protected readonly app: ImpressoApplication) {
    this.magicLinkConfig = app.get('magicLink')
    this.redisClient = app.service('redisClient').client as RedisClient
    this.sequelizeClient = app.get('sequelizeClient') as Sequelize
    this.profileModel = Profile.initModel(this.sequelizeClient)

    this.name = 'userEmailValidation'
    logger.debug(`Initialized service ${this.name}`)
  }

  async create(data: { token: string }, _params: Params): Promise<{ result: string }> {
    // Verify JWT signature with magic link secret
    try {
      jwt.verify(data.token, this.magicLinkConfig.secret)
    } catch (err) {
      logger.debug('Invalid token signature, verify failed')
      throw new BadRequest('Invalid or expired token')
    }
    const cacheKey = `user-email-verification:${data.token}`
    const tokenData = await this.redisClient.get(cacheKey)

    if (!tokenData) {
      logger.debug('Token not found in cache or expired')
      throw new BadRequest('Invalid or expired token')
    }
    logger.debug('user uid: ' + tokenData)
    // get user by id
    const profile = await this.profileModel
      .findOne({
        where: {
          user_id: tokenData,
        },
      })
      .catch(err => {
        logger.error('Error fetching user by id: ' + err)
        throw new BadRequest('Invalid or expired token')
      })
    if (!profile) {
      logger.debug('Profile not found for token: ' + data.token)
      throw new BadRequest('Invalid or expired token')
    }
    // check if emailVerified is already true
    if (profile.emailVerified) {
      logger.debug('Email already verified for user: ' + profile.user_id)
      throw new BadRequest('Email already verified')
    }
    const shouldUpdateProfile = !profile.get('emailVerified')
    if (!shouldUpdateProfile) {
      logger.debug('Email already verified for user: ' + profile.user_id)
      throw new BadRequest('Email already verified')
    }
    await profile.update({ emailVerified: true }).catch(err => {
      logger.error('Error updating emailVerified: ' + err)
      throw new BadRequest('Invalid or expired token')
    })

    // Delete token from cache (one-time use)
    try {
      await this.redisClient.del(cacheKey)
      logger.debug('[MagicLinkJWTStrategy] Deleted magic link token from cache')
    } catch (deleteErr) {
      logger.error('[MagicLinkJWTStrategy] Failed to delete magic link token from cache', { error: deleteErr })
    }
    return { result: 'ok' }
  }
}
