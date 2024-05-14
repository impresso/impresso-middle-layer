import { createSwaggerServiceOptions } from 'feathers-swagger'
import { docs } from './search.schema'

// Initializes the `search` service on path `/search`
const createService = require('./search.class.js')
const hooks = require('./search.hooks')

module.exports = function (app) {
  const paginate = app.get('paginate')
  const isPublicApi = app.get('isPublicApi')

  const options = {
    name: 'search',
    paginate,
    app,
  }

  app.use('/search', createService(options), {
    methods: isPublicApi ? ['find'] : undefined,
    events: [],
    docs: createSwaggerServiceOptions({ schemas: {}, docs }),
  })

  app.service('search').hooks(hooks)
}
