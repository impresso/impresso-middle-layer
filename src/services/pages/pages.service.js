// Initializes the `pages` service on path `/pages`
import createService from './pages.class.js'
import hooks from './pages.hooks'

export default function (app) {
  // Initialize our service with any options it requires
  app.use(
    '/pages',
    createService({
      name: 'pages',
      app,
    })
  )

  // Get our initialized service so that we can register hooks and filters
  const service = app.service('pages')

  service.hooks(hooks)
}
