// Initializes the `users` service on path `/users`
const createService = require('./users.class.js');
const hooks = require('./users.hooks');
const queries = require('decypher')(__dirname + '/users.queries.cyp');

module.exports = function (app) {

  const paginate = app.get('paginate');

  const options = {
    name: 'users',
    paginate,
    config: app.get('neo4j'),
    queries: queries
  };

  // Initialize our service with any options it requires
  app.use('/users', createService(options));

  // Get our initialized service so that we can register hooks and filters
  const service = app.service('users');

  service.hooks(hooks);
};
