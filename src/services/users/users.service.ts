import { Service } from '@/services/users/users.class.js'
import hooks from '@/services/users/users.hooks.js'
import type { ImpressoApplication } from '@/types.js'
import { ServiceOptions } from '@feathersjs/feathers'

export default (app: ImpressoApplication) => {
  const isPublicApi = app.get('isPublicApi')

  app.use(
    '/users',
    new Service({
      app,
      name: 'users',
    }),
    {
      methods: isPublicApi ? [] : undefined,
      events: [],
    } as ServiceOptions
  )

  const service = app.service('users')
  service.hooks(hooks)
}
