import type { Sequelize } from 'sequelize'
import initDebug from 'debug'
import type { ImpressoApplication } from '@/types.js'
import User from '@/models/users.model.js'
import { NotAuthenticated, BadRequest } from '@feathersjs/errors'

const debug = initDebug('impresso:services/change-password')

export interface ServiceOptions {
  app: ImpressoApplication
  name: string
}

export class Service {
  app: ImpressoApplication
  name: string
  sequelizeClient?: Sequelize
  constructor({ app, name }: ServiceOptions) {
    this.app = app
    this.name = name

    this.sequelizeClient = app.get('sequelizeClient')
    debug('change-password initialized.')
  }

  async create(
    data: {
      sanitized: {
        newPassword: string
        currentPassword: string
      }
    },
    params: { user: { id: number } }
  ) {
    if (!this.sequelizeClient) {
      throw new Error('Sequelize client not available')
    }
    debug('change-password.create', params.user.id)
    const userSequelize = User.sequelize(this.sequelizeClient)
    const user = await userSequelize.findOne({
      where: {
        id: params.user.id,
      },
    })
    if (!user || user.get('id') !== params.user.id) {
      throw new NotAuthenticated('User not found')
    }
    if (
      !User.comparePassword({
        encrypted: user.get('password') as string,
        password: data.sanitized.currentPassword,
      })
    ) {
      throw new BadRequest('Previous password is incorrect')
    }

    const updated = await userSequelize.update(
      {
        password: User.buildPassword({ password: data.sanitized.newPassword }),
      },
      {
        // criteria
        where: { id: params.user.id },
      }
    )
    debug('change-password.create', updated)
    return {
      response: 'ok',
    }
  }
}
