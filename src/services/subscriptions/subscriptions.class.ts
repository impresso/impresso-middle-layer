import type { Sequelize } from 'sequelize'
import type { ImpressoApplication } from '../../types'
import SubscriptionDataset from '../../models/subscription-datasets.model'

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
  }

  find() {
    if (!this.sequelizeClient) {
      throw new Error('Sequelize client not available')
    }
    // return user bitmap along with subscriptions
    const subscriptionDataset = SubscriptionDataset.sequelize(this.sequelizeClient)
    return subscriptionDataset.findAll()
  }
}
