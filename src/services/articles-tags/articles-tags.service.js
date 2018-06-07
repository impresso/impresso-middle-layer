// Initializes the `article_tags` service on path `/article-tags`
const createService = require('./articles-tags.class.js');
const hooks = require('./articles-tags.hooks.js');

module.exports = function(app) {

  const paginate = app.get('paginate');

  const options = {
    name: 'articles-tags',
    paginate,
    config: app.get('neo4j'),
  };

  // Initialize our service with any options it requires
  app.use('/articles-tags', createService(options));

  // Get our initialized service so that we can register hooks and filters
  const service = app.service('articles-tags');

  service.hooks(hooks);
};
