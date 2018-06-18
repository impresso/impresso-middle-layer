// Initializes the `pages` service on path `/pages`
const createService = require('./pages.class.js');
const hooks = require('./pages.hooks');

module.exports = function (app) {
  const paginate = app.get('paginate');

  const options = {
    name: 'pages',
    paginate,
    config: app.get('neo4j'),
  };

  // Initialize our service with any options it requires
  app.use('/pages', createService(options));

  // Get our initialized service so that we can register hooks and filters
  const service = app.service('pages');

  service.hooks(hooks);
};
