// Initializes the `buckets` service on path `/buckets`
import createService from './buckets.class.js'
import hooks from './buckets.hooks.js'

export default function (app) {
  const paginate = app.get('paginate')

  const options = {
    name: 'buckets',
    config: app.get('neo4j'),
    paginate,
    app,
  }

  // Initialize our service with any options it requires
  app.use('/buckets', createService(options))

  // Get our initialized service so that we can register hooks and filters
  const service = app.service('buckets')

  service.hooks(hooks)
}
