import { Service } from './subscriptions.class'
import { ImpressoApplication } from '../../types'
import { ServiceOptions } from '@feathersjs/feathers'

export default (app: ImpressoApplication) => {
  app.use(
    '/subscriptions',
    new Service({
      app,
      name: 'subscriptions',
    }),
    {
      events: [],
    } as ServiceOptions
  )
  const service = app.service('subscriptions')
  service.hooks({})
}
