import { MagicLinkService as Service } from '@/services/magic-link/magic-link.class.js'
import { ImpressoApplication } from '@/types.js'
import { ServiceOptions } from '@feathersjs/feathers'
import hooks from '@/services/magic-link/magic-link.hooks.js'

export default async (app: ImpressoApplication) => {
  app.use('/magic-link', new Service(app), {
    events: [],
  } as ServiceOptions)
  const service = app.service('magic-link')
  service.hooks(hooks)
}
