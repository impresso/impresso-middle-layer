import { createSwaggerServiceOptions } from 'feathers-swagger'
import { optionsDisabledInPublicApi } from '../../hooks/public-api'
import { docs } from './collectable-items.schema'

// Initializes the `collectable-items` service on path `/collectable-items`
const createService = require('./collectable-items.class.js')
const hooks = require('./collectable-items.hooks')

module.exports = function (app) {
  const paginate = app.get('paginate')

  const options = {
    name: 'collectable-items',
    paginate,
    app,
  }

  // Initialize our service with any options it requires
  app.use('/collectable-items', createService(options), {
    ...optionsDisabledInPublicApi(app),
    events: [],
    // disabled for now while it's not public
    docs: createSwaggerServiceOptions({ schemas: {}, docs }),
  })

  // Get our initialized service so that we can register hooks
  const service = app.service('collectable-items')

  service.hooks(hooks)
}
