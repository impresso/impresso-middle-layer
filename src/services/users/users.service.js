// Initializes the `users` service on path `/users`
const createService = require('./users.class.js');
const hooks = require('./users.hooks');

module.exports = function (app) {
  const paginate = app.get('paginate');

  const options = {
    name: 'users',
    paginate,
    app,
  };

  // Initialize our service with any options it requires
  app.use('/users', createService(options), {
    methods: [] /* disable all public methods - using internally. */,
  });

  // Get our initialized service so that we can register hooks and filters
  const service = app.service('users');

  service.hooks(hooks);
};
