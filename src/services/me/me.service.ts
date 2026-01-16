import { Service } from '@/services/me/me.class.js'
import type { ImpressoApplication } from '@/types.js'
import hooks from '@/services/me/me.hooks.js'
import { ServiceOptions } from '@feathersjs/feathers'

export default async (app: ImpressoApplication) => {
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
