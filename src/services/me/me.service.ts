import { Service } from './me.class'
import type { ImpressoApplication } from '../../types'
import hooks from './me.hooks'
import { ServiceOptions } from '@feathersjs/feathers'

export default (app: ImpressoApplication) => {
  app.use(
    '/me',
    new Service({
      app,
      name: 'me',
    }),
    {
      events: [],
    } as ServiceOptions
  )
  const service = app.service('me')
  service.hooks(hooks)
}
