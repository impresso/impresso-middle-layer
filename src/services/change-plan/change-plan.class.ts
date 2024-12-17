import type { Sequelize } from 'sequelize'
import initDebug from 'debug'
import type { ImpressoApplication } from '../../types'
import User from '../../models/users.model'
import { NotAuthenticated } from '@feathersjs/errors'

const debug = initDebug('impresso:services/change-plan')

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
    debug('Service initialized.')
  }

  async create(data: any, params: { user: { id: number } }) {
    if (!this.sequelizeClient) {
      throw new Error('Sequelize client not available')
    }
    debug('[create] for user.pk', params.user.id, 'plan:', data.plan, params.user)
    const userSequelize = User.sequelize(this.sequelizeClient)
    const user = await userSequelize.findOne({
      where: {
        id: params.user.id,
      },
      include: ['groups'],
    })
    if (!user) {
      throw new NotAuthenticated('User not found')
    }
    debug('[create] user is in groups:', user.get('groups'))

    return {
      response: 'ok',
    }
  }
}
