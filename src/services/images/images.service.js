// Initializes the `images` service on path `/images`
import hooks from './images.hooks'
const createService = require('./images.class.js')

module.exports = function (app) {
  // Initialize our service with any options it requires
  app.use(
    '/images',
    createService({
      app,
      name: 'images',
    })
  )

  // Get our initialized service so that we can register hooks
  const service = app.service('images')

  service.hooks(hooks)
}
