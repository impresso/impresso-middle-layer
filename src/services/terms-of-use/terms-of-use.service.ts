import { Service } from './terms-of-use.class'
import { ImpressoApplication } from '../../types'
import { ServiceOptions } from '@feathersjs/feathers'
import { authenticate } from '@feathersjs/authentication'

export default (app: ImpressoApplication) => {
  app.use(
    '/terms-of-use',
    new Service({
      app,
      name: 'terms-of-use',
    }),
    {
      events: [],
    } as ServiceOptions
  )
  const service = app.service('terms-of-use')
  service.hooks({
    before: {
      all: [authenticate('jwt')],
    },
  })
}
