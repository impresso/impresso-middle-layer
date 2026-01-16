// Initializes the `users` service on path `/users`
import createService from '@/services/users/users.class.js'
import hooks from '@/services/users/users.hooks.js'

export default function (app) {
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
