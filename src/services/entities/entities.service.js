import { createSwaggerServiceOptions } from 'feathers-swagger'
import { getDocs } from './entities.schema'
import hooks from './entities.hooks'

// Initializes the `entities` service on path `/entities`
const createService = require('./entities.class')

module.exports = function (app) {
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
