// Initializes the `search-queries-comparison` service on path `/search-queries-comparison`
const { SearchQueriesComparison } = require('./search-queries-comparison.class');
const hooks = require('./search-queries-comparison.hooks');

module.exports = function (app) {
  const paginate = app.get('paginate');

  const options = {
    paginate,
  };

  // Initialize our service with any options it requires
  app.use('/search-queries-comparison', new SearchQueriesComparison(options, app));

  // Get our initialized service so that we can register hooks
  const service = app.service('search-queries-comparison');

  service.hooks(hooks);
};
