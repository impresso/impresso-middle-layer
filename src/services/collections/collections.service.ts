import { createSwaggerServiceOptions } from 'feathers-swagger'
import { getDocs } from './collections.schema.js'
import { ImpressoApplication } from '../../types'
import hooks from './collections.hooks.js'
import { ServiceOptions } from '@feathersjs/feathers'
import { Service } from './collections.class.js'

// Initializes the `collections` service on path `/collections`
const init = (app: ImpressoApplication) => {
  const paginate = app.get('paginate')
  const isPublicApi = app.get('isPublicApi') ?? false

  const options = {
    name: 'collections',
    paginate,
    app,
  }

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
