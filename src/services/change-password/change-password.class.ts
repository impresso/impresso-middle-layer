import type { Sequelize } from 'sequelize'
import initDebug from 'debug'
import type { ImpressoApplication } from '../../types'
import User from '../../models/users.model'
import { NotAuthenticated } from '@feathersjs/errors'

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

  async create(data: any, params: { user: { id: number } }) {
    if (!this.sequelizeClient) {
      throw new Error('Sequelize client not available')
    }
    debug('change-password.create', data, params.user.id)
    const user = await User.sequelize(this.sequelizeClient).findOne({
      where: {
        id: params.user.id,
      },
    })
    if (!user) {
      throw new NotAuthenticated('User not found')
    }
    debug('change-password.create', user.get('password'))
    return {
      id: user.get('id'),
    }
  }
}
