import { createSwaggerServiceOptions } from 'feathers-swagger'
import { getDocs } from './collections.schema'
import { ImpressoApplication } from '../../types'
import hooks from './collections.hooks'
import { ServiceOptions } from '@feathersjs/feathers'

// Initializes the `collections` service on path `/collections`
const createService = require('./collections.class.js')
// const hooks = require('./collections.hooks')

const init = (app: ImpressoApplication) => {
  const paginate = app.get('paginate')
  const isPublicApi = app.get('isPublicApi') ?? false

  const options = {
    name: 'collections',
    paginate,
    app,
  }

  // Initialize our service with any options it requires
  app.use('/collections', createService(options), {
    events: [],
    docs: createSwaggerServiceOptions({ schemas: {}, docs: getDocs(isPublicApi) }),
  } as ServiceOptions)

  // Get our initialized service so that we can register hooks
  const service = app.service('collections')
  service.setup(app)

  service.hooks(hooks)
}

export default init
