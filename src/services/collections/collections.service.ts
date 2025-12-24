import { createSwaggerServiceOptions } from '@/util/feathers.js'
import { getDocs } from '@/services/collections/collections.schema.js'
import { ImpressoApplication } from '@/types.js'
import { ServiceOptions } from '@feathersjs/feathers'

// import { Service } from '@/services/collections/collections.class.deprecated.js'
// import hooks from '@/services/collections/collections.hooks.deprecated.js'
import { CollectionsService as Service } from '@/services/collections/collections.class.js'
import hooks from '@/services/collections/collections.hooks.js'

// Initializes the `collections` service on path `/collections`
const init = (app: ImpressoApplication) => {
  const isPublicApi = app.get('isPublicApi') ?? false

  // Initialize our service with any options it requires
  app.use('/collections', new Service(app), {
    events: [],
    docs: createSwaggerServiceOptions({ schemas: {}, docs: getDocs(isPublicApi) }),
  } as ServiceOptions)

  // Get our initialized service so that we can register hooks
  const service = app.service('collections')
  service.hooks(hooks)
}

export default init
