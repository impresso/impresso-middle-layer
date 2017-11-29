// Initializes the `articles` service on path `/articles`
const createService = require('./articles.class.js');
const hooks = require('./articles.hooks');
const filters = require('./articles.filters');

module.exports = function () {
  const app = this;
  const paginate = app.get('paginate');

  const options = {
    name: 'articles',
    paginate
  };

  // Initialize our service with any options it requires
  app.use('/articles', createService(options));

  // Get our initialized service so that we can register hooks and filters
  const service = app.service('articles');

  service.hooks(hooks);

  if (service.filter) {
    service.filter(filters);
  }
};
