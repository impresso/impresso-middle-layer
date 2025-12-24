import { createSwaggerServiceOptions } from '@/util/feathers.js'
import { getDocs } from '@/services/entities/entities.schema.js'
import hooks from '@/services/entities/entities.hooks.js'

// Initializes the `entities` service on path `/entities`
import createService from '@/services/entities/entities.class.js'

export default function (app) {
  const options = {
    name: 'entities',
    app,
  }
  const isPublicApi = app.get('isPublicApi')

  // Initialize our service with any options it requires
  app.use('/entities', createService(options), {
    events: [],
    methods: isPublicApi ? ['find', 'get'] : undefined,
    docs: createSwaggerServiceOptions({ schemas: {}, docs: getDocs(isPublicApi) }),
  })

  // Get our initialized service so that we can register hooks
  const service = app.service('entities')

  service.hooks(hooks)
}
