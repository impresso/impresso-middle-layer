// Initializes the `search-facets` service on path `/search-facets`
const createService = require('./search-facets.class.js');
const hooks = require('./search-facets.hooks');

module.exports = function (app) {
  // Initialize our service with any options it requires
  app.use('/search-facets', createService({
    app,
    name: 'search-facets',
  }));

  // Get our initialized service so that we can register hooks
  const service = app.service('search-facets');

  service.hooks(hooks);
};
