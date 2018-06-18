// Initializes the `queries` service on path `/queries`
const createService = require('./queries.class.js');
const hooks = require('./queries.hooks');

module.exports = function (app) {
  const paginate = app.get('paginate');

  const options = {
    name: 'queries',
    paginate,
    config: app.get('neo4j'),
  };

  // Initialize our service with any options it requires
  app.use('/queries', createService(options));

  // Get our initialized service so that we can register hooks and filters
  const service = app.service('queries');

  service.hooks(hooks);
};
