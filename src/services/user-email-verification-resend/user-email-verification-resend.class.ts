import { createHash, randomBytes } from 'crypto'
import { getLogger } from '@/logger.js'
import { Config } from '@/models/generated/app/configuration.js'
import Profile from '@/models/profiles.model.js'
import User from '@/models/users.model.js'
import { RedisClient } from '@/redis.js'
import { ImpressoApplication } from '@/types.js'
import { GeneralError } from '@feathersjs/errors'
import { Params } from '@feathersjs/feathers'
import { Sequelize } from 'sequelize'

const logger = getLogger(['impresso', 'services', 'user-email-verification-resend'])

interface CreateData {
  email: string
  sanitized?: {
    email: string
  }
}

interface CreateResult {
  result: 'ok' | 'wait'
  retryAfterSeconds?: number
}

const RESEND_COOLDOWN_SECONDS = 15 * 60
const RESEND_DAILY_LIMIT = 3
const RESEND_DAILY_WINDOW_SECONDS = 24 * 60 * 60
const RESEND_EMAIL_HASH_LIMIT = 5
const RESEND_EMAIL_HASH_WINDOW_SECONDS = 60 * 60
const RESEND_VERIFICATION_TASK = 'impresso.tasks.resend_user_email_verification'

export class UserEmailVerificationResendService {
  protected readonly emailVerificationConfig: Config['emailVerification']
  protected readonly redisClient: RedisClient
  protected readonly userModel: ReturnType<typeof User.sequelize>
  protected readonly profileModel: ReturnType<typeof Profile.initModel>

  constructor(protected readonly app: ImpressoApplication) {
    const sequelizeClient = app.get('sequelizeClient') as Sequelize
    this.emailVerificationConfig = app.get('emailVerification') as Config['emailVerification']
    this.redisClient = app.service('redisClient').client as RedisClient
    this.userModel = User.sequelize(sequelizeClient)
    this.profileModel = Profile.initModel(sequelizeClient)
  }

  async create(data: CreateData, _params?: Params): Promise<CreateResult> {
    const email = data.sanitized?.email ?? data.email
    const normalizedEmail = email.trim().toLowerCase()
    const emailHash = createHash('sha256').update(normalizedEmail).digest('hex')
    const emailHashKey = `user-email-verification:resend-email-hash:${emailHash}`

    const emailHashCount = Number.parseInt((await this.redisClient.get(emailHashKey)) ?? '0', 10)
    if (emailHashCount >= RESEND_EMAIL_HASH_LIMIT) {
      return {
        result: 'wait',
        retryAfterSeconds: RESEND_EMAIL_HASH_WINDOW_SECONDS,
      }
    }
    await this.redisClient.setEx(emailHashKey, RESEND_EMAIL_HASH_WINDOW_SECONDS, String(emailHashCount + 1))

    const user = await this.userModel.findOne({
      where: {
        email: normalizedEmail,
      },
    })

    if (!user || Boolean(user.get('isActive'))) {
      return { result: 'ok' }
    }

    const userId = user.get('id') as number
    const profile = await this.profileModel.findOne({
      where: {
        user_id: userId,
      },
    })

    if (!profile || profile.emailVerified) {
      return { result: 'ok' }
    }

    const activeByUserKey = `user-email-verification:active-by-user:${userId}`
    const cooldownKey = `user-email-verification:resend-cooldown:${userId}`
    const dailyKey = `user-email-verification:resend-daily:${userId}`

    const activeToken = await this.redisClient.get(activeByUserKey)
    if (activeToken) {
      return {
        result: 'wait',
        retryAfterSeconds: this.emailVerificationConfig.expiration,
      }
    }

    const activeCooldown = await this.redisClient.get(cooldownKey)
    if (activeCooldown) {
      return {
        result: 'wait',
        retryAfterSeconds: RESEND_COOLDOWN_SECONDS,
      }
    }

    const dailyCount = Number.parseInt((await this.redisClient.get(dailyKey)) ?? '0', 10)
    if (dailyCount >= RESEND_DAILY_LIMIT) {
      return {
        result: 'wait',
        retryAfterSeconds: RESEND_DAILY_WINDOW_SECONDS,
      }
    }

    const token = randomBytes(32).toString('base64url')
    const callbackUrl = this.app.get('callbackUrls')?.emailVerification

    const celeryClient = this.app.get('celeryClient')
    if (!celeryClient) {
      logger.error('Celery client not configured; cannot send verification resend email')
      throw new GeneralError('Verification email service is currently unavailable')
    }

    try {
      await celeryClient.run({
        task: RESEND_VERIFICATION_TASK,
        args: [userId, token, callbackUrl],
      })
    } catch (error) {
      logger.error('Failed to enqueue verification resend email', { error })
      throw new GeneralError('Verification email service is currently unavailable')
    }

    // Only persist the new token and throttle counters once the email has
    // actually been queued for delivery, so a Celery failure doesn't consume
    // one of the user's limited resend attempts without ever sending anything.
    await this.redisClient.setEx(
      `user-email-verification:${token}`,
      this.emailVerificationConfig.expiration,
      String(userId)
    )
    await this.redisClient.setEx(activeByUserKey, this.emailVerificationConfig.expiration, token)
    await this.redisClient.setEx(cooldownKey, RESEND_COOLDOWN_SECONDS, '1')
    await this.redisClient.setEx(dailyKey, RESEND_DAILY_WINDOW_SECONDS, String(dailyCount + 1))

    return { result: 'ok' }
  }
}
