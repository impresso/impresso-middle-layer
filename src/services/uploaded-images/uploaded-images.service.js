// Initializes the `uploaded-images` service on path `/uploaded-images`
import createService from '@/services/uploaded-images/uploaded-images.class.js'
import hooks from '@/services/uploaded-images/uploaded-images.hooks.js'

export default function (app) {
  // Initialize our service with any options it requires
  app.use(
    '/uploaded-images',
    createService({
      name: 'uploaded-images',
      app,
    })
  )

  // Get our initialized service so that we can register hooks
  const service = app.service('uploaded-images')

  service.hooks(hooks)
}
