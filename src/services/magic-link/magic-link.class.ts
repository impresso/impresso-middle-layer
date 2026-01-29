import { AuthConfig } from '@/models/generated/common.js'
import User from '@/models/users.model.js'
import type { ImpressoApplication } from '@/types.js'
import type { Params } from '@feathersjs/feathers'
import { Sequelize } from 'sequelize'
import Debug from 'debug'
import { NotFound, Unavailable } from '@feathersjs/errors'
import jwt from 'jsonwebtoken'
import { CeleryClient } from '@/celery.js'

const debug = Debug('impresso:services:magic-link')

export interface CreateData {
  email: string
}

export interface CreateResult {
  result: string
}

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
      throw new NotFound()
    }
    // Generate a unique token for the user's password reset request
    const token = jwt.sign({ email: data.email }, this.config.secret, { expiresIn: 60 * 5 })
    debug('[create] Generated magic link token for email:', data.email, 'token:', token, 'userId:', user.get('id'))

    await this.celeryClient
      .run({
        task: 'impresso.tasks.send_magic_link_email',
        args: [
          // user id
          user.get('id'),
          // token
          token,
        ],
      })
      .catch((err: Error) => {
        debug('[create] Error sending magic link email to', data.email, 'error:', err)
        throw new Unavailable('Failed to send email')
      })

    return {
      result: 'ok',
    }
  }
}
