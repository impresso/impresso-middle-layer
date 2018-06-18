// Initializes the `articles` service on path `/articles`
const createService = require('./articles.class.js');
const hooks = require('./articles.hooks');
const queries = require('decypher')(`${__dirname}/articles.queries.cyp`);


module.exports = function (app) {
  const paginate = app.get('paginate');

  const options = {
    name: 'articles',
    paginate,
    // need to pass config and queries to neo4j.service
    config: app.get('neo4j'),
  };

  // Initialize our service with any options it requires
  app.use('/articles', createService(options));

  // Get our initialized service so that we can register hooks and filters
  const service = app.service('articles');

  service.hooks(hooks);
};
