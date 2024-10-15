import type { Sequelize } from 'sequelize'
import type { ImpressoApplication } from '../../types'
import User from '../../models/users.model'
import type { Params as FeathersParams } from '@feathersjs/feathers'
import Debug from 'debug'
import UserRequest from '../../models/user-requests.model'

const debug = Debug('impresso/services:user-requests')

interface Params extends FeathersParams {
  user: {
    id: string
    uid: string
  }
}

export interface ServiceOptions {
  app: ImpressoApplication
  name: string
}
/**
 * Service to retrieve account details,
 * e.g. latest terms of use acceptance date, list of subscription, user bitmap.
 *
 *    DEBUG=impresso/services:account-details npm run dev
 *
 * This service return a userBitmap object with the date the user accepted the terms of use.
 * /account-details find() method, it uses the authenticated user id from hook to find the user bitmap record.
 * /account-details patch() method, for the moment being, this just updates the dateAcceptedTerms field in the user bitmap record.
 * Subscription need to be validated by admin users, so they arent part of this service.
 *
 * @param {ImpressoApplication} app
 * @param {string} name
 * @returns {ServiceMethods}
 *
 *
 */
export class Service {
  app: ImpressoApplication
  name: string
  sequelizeClient?: Sequelize
  constructor({ app, name }: ServiceOptions) {
    this.app = app
    this.name = name
    this.sequelizeClient = app.get('sequelizeClient')
  }

  async find(params: Params) {
    if (!this.sequelizeClient) {
      throw new Error('Sequelize client not available')
    }
    // return user bitmap
    const model = UserRequest.sequelize(this.sequelizeClient)
    const [result, created] = await model.findOrCreate({
      where: { subscriberId: params.user.id },
    })
    if (created) {
      debug('find() User bitmap found:', result.toJSON(), 'created:', created, 'user pk:', params.user.uid)
    }
    return result.toJSON()
  }
}
