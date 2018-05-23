// Initializes the `tags` service on path `/tags`
const createService = require('./tags.class.js');
const hooks = require('./tags.hooks');

module.exports = function (app) {

  const paginate = app.get('paginate');

  const options = {
    name: 'tags',
    paginate,
    config: app.get('neo4j'),
  };

  // Initialize our service with any options it requires
  app.use('/tags', createService(options));

  // Get our initialized service so that we can register hooks and filters
  const service = app.service('tags');

  service.hooks(hooks);
};
