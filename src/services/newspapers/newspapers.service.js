// Initializes the `newspapers` service on path `/newspapers`
const createService = require('../neo4j.service');
const hooks = require('./newspapers.hooks');
const queries = require('decypher')(__dirname + '/newspapers.queries.cyp');


module.exports = function (app) {
  
  const paginate = app.get('paginate');

  const options = {
    name: 'newspapers',
    paginate,
    config: app.get('neo4j'),
    queries: queries
  };

  // Initialize our service with any options it requires
  app.use('/newspapers', createService(options));

  // Get our initialized service so that we can register hooks and filters
  const service = app.service('newspapers');

  service.hooks(hooks);
};
