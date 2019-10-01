// Initializes the `search-queries-comparison` service on path `/search-queries-comparison`
const { SearchQueriesComparison } = require('./search-queries-comparison.class');
const hooks = require('./search-queries-comparison.hooks');

module.exports = function (app) {
  app.use('/search-queries-comparison', new SearchQueriesComparison());
  app.service('search-queries-comparison').hooks(hooks);
};
