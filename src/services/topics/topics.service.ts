// Initializes the `topics` service on path `/topics`
import { createSwaggerServiceOptions } from 'feathers-swagger'
import { ServiceOptions } from '@feathersjs/feathers'
import { ImpressoApplication } from '../../types'
import { Service } from './topics.class'
import hooks from './topics.hooks'
import { getDocs } from './topics.schema'

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
