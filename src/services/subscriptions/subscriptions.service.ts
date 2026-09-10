import { Service } from '@/services/subscriptions/subscriptions.class.js'
import { ImpressoApplication } from '@/types.js'
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
