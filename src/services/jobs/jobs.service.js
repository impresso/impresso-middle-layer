// Initializes the `jobs` service on path `/jobs`
import createService from '@/services/jobs/jobs.class.js'
import hooks from '@/services/jobs/jobs.hooks.js'

export default async function (app) {
  // Initialize our service with any options it requires
  app.use(
    '/jobs',
    await createService({
      name: 'jobs',
      app,
    })
  )

  // Get our initialized service so that we can register hooks
  const service = app.service('jobs')
  await service.setup(app)

  service.hooks(hooks)
}
