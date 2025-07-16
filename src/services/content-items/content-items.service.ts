import { ServiceOptions } from '@feathersjs/feathers'
import { createSwaggerServiceOptions } from 'feathers-swagger'
import { ImpressoApplication } from '../../types'
import { docs } from './content-items.schema'
import createService from './content-items.class'
import hooks from './content-items.hooks'

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
