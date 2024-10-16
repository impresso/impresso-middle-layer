import type { Sequelize } from 'sequelize'
import type { ImpressoApplication } from '../../types'
import UserBitmap, { BufferUserPlanAuthUser } from '../../models/user-bitmap.model'
import User from '../../models/users.model'
import type { Params as FeathersParams } from '@feathersjs/feathers'
import Debug from 'debug'

const debug = Debug('impresso/services:account-details')

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
    const model = UserBitmap.sequelize(this.sequelizeClient)
    const [result, created] = await model.findOrCreate({
      where: { user_id: params.user.id },
    })
    if (created) {
      debug('find() User bitmap found:', result.toJSON(), 'created:', created, 'user pk:', params.user.uid)
    }
    return result.toJSON()
  }

  async patch(_id: any, data: any, params: Params) {
    if (!this.sequelizeClient) {
      throw new Error('Sequelize client not available')
    }
    const model = UserBitmap.sequelize(this.sequelizeClient as Sequelize)
    // when user accepts terms of use, update the dateAcceptedTerms field
    debug('Updating user bitmap with terms of use acceptance, user uid:', params.user.uid)
    const [result, created] = await model.findOrCreate({
      where: { user_id: params.user.id },
      defaults: {
        user_id: parseInt(params.user.id, 10),
        // set user as authenticated user
        bitmap: Buffer.from([Number(BufferUserPlanAuthUser)]),
        subscriptionDatasets: [],
        dateAcceptedTerms: new Date(),
      },
    })
    if (!created) {
      debug('patch() user bitmap for user pk:', params.user.id, 'already exists, update dateAcceptedTerms.')
      await result.update({
        dateAcceptedTerms: new Date(),
      })
    }
    debug('patch() User bitmap updated:', result.toJSON(), params.user)
    return result.toJSON()
  }
}
