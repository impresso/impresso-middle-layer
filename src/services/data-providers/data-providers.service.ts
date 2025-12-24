import { createSwaggerServiceOptions } from '@/util/feathers.js'
import { getDocs } from './data-providers.schema.js'
import { DataProviders } from './data-providers.class.js'
import { ImpressoApplication } from '@/types.js'
import hooks from './data-providers.hooks.js'
import { ServiceOptions } from '@feathersjs/feathers'

export default function (app: ImpressoApplication) {
  const isPublicApi = app.get('isPublicApi') ?? false

  // Initialize our service with any options it requires
  app.use('/data-providers', new DataProviders(), {
    events: [],
    docs: createSwaggerServiceOptions({ schemas: {}, docs: getDocs(isPublicApi) }),
  } as ServiceOptions)

  app.service('data-providers').hooks(hooks)
}
