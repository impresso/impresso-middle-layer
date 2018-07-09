// Initializes the `buckets-items` service on path `/buckets-items`
const createService = require('./buckets-items.class.js');
const hooks = require('./buckets-items.hooks');

module.exports = function (app) {
  const paginate = app.get('paginate');

  const options = {
    name: 'buckets-items',
    paginate,
    config: app.get('neo4j'),
    app: app
  };

  // Initialize our service with any options it requires
  app.use('/buckets-items', createService(options));

  // Get our initialized service so that we can register hooks and filters
  const service = app.service('buckets-items');

  service.hooks(hooks);
};
