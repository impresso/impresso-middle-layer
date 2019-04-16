// Initializes the `articles-suggestions` service on path `/articles-suggestions`
const createService = require('./articles-suggestions.class.js');
const hooks = require('./articles-suggestions.hooks');

module.exports = function (app) {
  
  const paginate = app.get('paginate');

  const options = {
    paginate
  };

  // Initialize our service with any options it requires
  app.use('/articles-suggestions', createService(options));

  // Get our initialized service so that we can register hooks
  const service = app.service('articles-suggestions');

  service.hooks(hooks);
};
