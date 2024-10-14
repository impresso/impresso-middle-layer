import type { Sequelize } from 'sequelize'
import type { ImpressoApplication } from '../../types'
import UserBitmap from '../../models/user-bitmap.model'
import type { Params as FeathersParams, ServiceMethods } from '@feathersjs/feathers'
import Debug from 'debug'

const debug = Debug('impresso/services:terms-of-use')

interface Params extends FeathersParams {
  user: {
    id: string
  }
}

export interface ServiceOptions {
  app: ImpressoApplication
  name: string
}
/**
 * Service for terms of use
 * This service return a simple object with the date the user accepted the terms of use, that can be null
 * The service also allows to update the dateAcceptedTerms field when the user accepts the terms of use
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
      where: { user_id: 5 },
    })
    debug('User bitmap found:', result, 'created:', created)
    return {
      dateAcceptedTerms: (result as any)?.dateAcceptedTerms,
    }
  }

  async patch(_id: any, data: any, params?: Params) {
    if (!this.sequelizeClient) {
      throw new Error('Sequelize client not available')
    }
    const model = UserBitmap.sequelize(this.sequelizeClient as Sequelize)
    // when user accepts terms of use, update the dateAcceptedTerms field
    debug('Updating user bitmap with terms of use acceptance, user uid:', params?.user, 'data', data)
    const result = await model.findOne({
      where: { user_id: params?.user.id ?? -1 },
    })
    if (result) {
      return result.update({ dateAcceptedTerms: new Date() }).then((updated: any) => {
        return { dateAcceptedTerms: updated.dateAcceptedTerms }
      })
    }
    return result
  }
}
