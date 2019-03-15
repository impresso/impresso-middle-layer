// Initializes the `pages` service on path `/pages`
const createService = require('./pages.class.js');
const hooks = require('./pages.hooks');

module.exports = function (app) {
  // Initialize our service with any options it requires
  app.use('/pages', createService({
    name: 'pages',
    app,
  }));

  // Get our initialized service so that we can register hooks and filters
  const service = app.service('pages');

  service.hooks(hooks);
};
