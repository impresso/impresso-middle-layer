import type { Sequelize } from 'sequelize'
import initDebug from 'debug'
import type { ImpressoApplication } from '../../types'
import User from '../../models/users.model'
import { BadRequest, NotFound } from '@feathersjs/errors'
import UserChangePlanRequest from '../../models/user-change-plan-request'

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

  async find(params: { user: { id: number } }) {
    if (!this.sequelizeClient) {
      throw new Error('Sequelize client not available')
    }
    debug('[find] plan request for user.pk', params.user.id, params.user)
    const userChangePlanRequestModel = UserChangePlanRequest.initModel(this.sequelizeClient)
    const userChangePlanRequest = await userChangePlanRequestModel.findOne({
      where: {
        userId: params.user.id,
      },
      include: ['plan'],
    })
    if (!userChangePlanRequest) {
      throw new NotFound()
    }
    return userChangePlanRequest?.get()
  }

  async create(data: any, params: { user: { id: number } }) {
    const client = this.app.get('celeryClient')
    if (!client) {
      throw new Error('Celery client not available')
    }
    if (!this.sequelizeClient) {
      throw new Error('Sequelize client not available')
    }
    debug('[create] plan request for user.pk', params.user.id, 'plan:', data.plan, params.user)
    // check if the user is already in the process of changing the plan
    const userChangePlanRequestModel = UserChangePlanRequest.initModel(this.sequelizeClient)
    const userChangePlanRequest = await userChangePlanRequestModel.findOne({
      where: {
        userId: params.user.id,
      },
    })
    if (userChangePlanRequest) {
      // return the existing request as data in BadRequest error
      throw new BadRequest('User is already in the process of changing the plan', 
        userChangePlanRequest?.get())
    }
    // check if the user already belongs to the data.plan (it is a group name)
    const user = await User.sequelize(this.sequelizeClient).findByPk(params.user.id, {
      include: ['groups'],
    })
    if (!user) {
      throw new NotFound()
    }

    return client
      .run({
        task: 'impresso.tasks.email_plan_change',
        // email_plan_change(self, user_id: int, plan: str = None)
        args: [params.user.id, data.plan],
      })
      .catch((error: Error) => {
        debug('[create] error:', error)
        throw error
      })
      .then(() => ({
        response: 'ok',
      }))
  }
}
