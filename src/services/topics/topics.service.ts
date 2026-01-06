// Initializes the `topics` service on path `/topics`
import { createSwaggerServiceOptions } from '@/util/feathers.js'
import { ServiceOptions } from '@feathersjs/feathers'
import { ImpressoApplication } from '@/types.js'
import { Service } from '@/services/topics/topics.class.js'
import hooks from '@/services/topics/topics.hooks.js'
import { getDocs } from '@/services/topics/topics.schema.js'

export default function (app: ImpressoApplication) {
  const isPublicApi = app.get('isPublicApi') ?? false

  const options = {
    name: 'topics',
    app,
  }

  // Initialize our service with any options it requires
  app.use('/topics', new Service(options), {
    events: [],
    docs: createSwaggerServiceOptions({ schemas: {}, docs: getDocs(isPublicApi) }),
  } as ServiceOptions)

  // Get our initialized service so that we can register hooks
  const service = app.service('topics')

  service.hooks(hooks)
}
