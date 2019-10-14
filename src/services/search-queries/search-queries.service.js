// Initializes the `search-queries` service on path `/search-queries`
const { SearchQueries } = require('./search-queries.class');
const hooks = require('./search-queries.hooks');

module.exports = function (app) {
  
  const paginate = app.get('paginate');

  const options = {
    paginate
  };

  // Initialize our service with any options it requires
  app.use('/search-queries', new SearchQueries(options, app));

  // Get our initialized service so that we can register hooks
  const service = app.service('search-queries');

  service.hooks(hooks);
};
