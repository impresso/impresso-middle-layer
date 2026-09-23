import { createSwaggerServiceOptions } from '@/util/feathers.js'
import { PagesService as Service } from '@/services/pages/pages.class.js'
import { getDocs } from '@/services/pages/pages.schema.js'
import hooks from '@/services/pages/pages.hooks.js'
import type { ImpressoApplication } from '@/types.js'
import { ServiceOptions } from '@feathersjs/feathers'

export default async (app: ImpressoApplication) => {
  const isPublicApi = app.get('isPublicApi') ?? false

  app.use('/pages', new Service(app), {
    events: [],
    docs: createSwaggerServiceOptions({ schemas: {}, docs: getDocs(isPublicApi) }),
  } as ServiceOptions)

  app.service('pages').hooks(hooks)
}
