const { ArticlesSearch } = require('./articles-search.class');
const hooks = require('./articles-search.hooks');

module.exports = function (app) {
  const options = {};

  // Initialize our service with any options it requires
  app.use('/articles-search', new ArticlesSearch(options, app));

  // Get our initialized service so that we can register hooks
  const service = app.service('articles-search');

  service.hooks(hooks);
};
