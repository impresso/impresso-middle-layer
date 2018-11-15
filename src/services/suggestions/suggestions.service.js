// Initializes the `suggestions` service on path `/suggestions`
const createService = require('./suggestions.class.js');
const hooks = require('./suggestions.hooks');
const queries = require('decypher')(`${__dirname}/suggestions.queries.cyp`);


module.exports = function (app) {
  const paginate = app.get('paginate');

  const options = {
    name: 'suggestions',
    paginate,
    config: app.get('neo4j'),
    queries,
    app,
  };

  // Initialize our service with any options it requires
  app.use('/suggestions', createService(options));

  // Get our initialized service so that we can register hooks and filters
  const service = app.service('suggestions');

  service.hooks(hooks);
};
