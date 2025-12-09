// Initializes the `jobs` service on path `/jobs`
import createService from './jobs.class.js'
import hooks from './jobs.hooks.js'

export default function (app) {
  // Initialize our service with any options it requires
  app.use(
    '/jobs',
    createService({
      name: 'jobs',
      app,
    })
  )

  // Get our initialized service so that we can register hooks
  const service = app.service('jobs')
  service.setup(app)

  service.hooks(hooks)
}
