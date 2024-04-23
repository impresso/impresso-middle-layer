// Initializes the `users` service on path `/users`
const createService = require('./users.class.js')
const hooks = require('./users.hooks')

module.exports = function (app) {
  const paginate = app.get('paginate')
  const isPublicApi = app.get('isPublicApi')

  const options = {
    name: 'users',
    paginate,
    app,
  }

  // Initialize our service with any options it requires
  app.use('/users', createService(options), {
    methods: isPublicApi ? [] : undefined /* disable all public methods in public API - using internally. */,
    events: [],
  })

  // Get our initialized service so that we can register hooks and filters
  const service = app.service('users')

  service.hooks(hooks)
}
