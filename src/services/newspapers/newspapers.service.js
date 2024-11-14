import { createSwaggerServiceOptions } from 'feathers-swagger'
import { getDocs } from './newspapers.schema'

// Initializes the `newspapers` service on path `/newspapers`
const createService = require('./newspapers.class')
const hooks = require('./newspapers.hooks')

module.exports = function (app) {
  const options = {
    name: 'newspapers',
    app,
  }
  const isPublicApi = app.get('isPublicApi')

  // Initialize our service with any options it requires
  app.use('/newspapers', createService(options), {
    events: [],
    docs: createSwaggerServiceOptions({ schemas: {}, docs: getDocs(isPublicApi) }),
  })

  // Get our initialized service so that we can register hooks and filters
  const service = app.service('newspapers')

  service.hooks(hooks)
}
