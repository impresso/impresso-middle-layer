// Initializes the `issues` service on path `/issues`
import hooks from '@/services/issues/issues.hooks.js'
import createService from '@/services/issues/issues.class.js'

export default async function (app) {
  const paginate = app.get('paginate')

  const options = {
    name: 'issues',
    paginate,
    app,
  }

  // Initialize our service with any options it requires
  app.use('/issues', await createService(options))

  // Get our initialized service so that we can register hooks and filters
  const service = app.service('issues')

  service.hooks(hooks)
}
