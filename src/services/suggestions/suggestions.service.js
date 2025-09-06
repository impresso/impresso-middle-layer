// Initializes the `suggestions` service on path `/suggestions`
import createService from './suggestions.class.js'
import hooks from './suggestions.hooks'

export default function (app) {
  // Initialize our service with any options it requires
  app.use(
    '/suggestions',
    createService({
      app,
      name: 'suggestions',
    })
  )

  // Get our initialized service so that we can register hooks and filters
  const service = app.service('suggestions')

  service.hooks(hooks)
}
