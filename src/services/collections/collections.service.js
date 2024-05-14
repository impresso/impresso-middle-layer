import { createSwaggerServiceOptions } from 'feathers-swagger'
import { docs } from './collections.schema'

// Initializes the `collections` service on path `/collections`
const createService = require('./collections.class.js')
const hooks = require('./collections.hooks')

module.exports = function (app) {
  const paginate = app.get('paginate')

  const options = {
    name: 'collections',
    paginate,
    app,
  }

  // Initialize our service with any options it requires
  app.use('/collections', createService(options), {
    events: [],
    docs: createSwaggerServiceOptions({ schemas: {}, docs }),
  })

  // Get our initialized service so that we can register hooks
  const service = app.service('collections')

  service.hooks(hooks)
}
