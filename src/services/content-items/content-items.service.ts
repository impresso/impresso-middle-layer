import { ServiceOptions } from '@feathersjs/feathers'
import { createSwaggerServiceOptions } from 'feathers-swagger'
import { ImpressoApplication } from '@/types.js'
import { docs } from '@/services/content-items/content-items.schema.js'
import createService from '@/services/content-items/content-items.class.js'
import hooks from '@/services/content-items/content-items.hooks.js'

export default function (app: ImpressoApplication) {
  const isPublicApi = app.get('isPublicApi') ?? false

  const svc = createService({ app })

  // Initialize our service with any options it requires
  app.use('/content-items', svc, {
    events: [],
    methods: isPublicApi ? ['get'] : ['get', 'find'],
    docs: createSwaggerServiceOptions({ schemas: {}, docs }),
  } as ServiceOptions)

  app.service('content-items').hooks(hooks)
}
