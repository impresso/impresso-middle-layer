import hooksV1 from './images-v1.hooksoks'
import ServiceV1 from './images-v1.class'

module.exports = function (app) {
  // Initialize our service with any options it requires
  app.use(
    '/images',
    new ServiceV1({
      app,
      name: 'images',
    })
  )

  // Get our initialized service so that we can register hooks
  const service = app.service('images')

  service.hooks(hooksV1)
}
