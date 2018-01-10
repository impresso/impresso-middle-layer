// Initializes the `issues` service on path `/issues`
const createService = require('../neo4j.service');
const hooks = require('./issues.hooks');
const queries = require('decypher')(__dirname + '/issues.queries.cyp');


module.exports = function (app) {
  
  const paginate = app.get('paginate');

  const options = {
    name: 'issues',
    paginate,
    run: app.get('neo4jSessionRunner'),
    queries: queries
  };

  // Initialize our service with any options it requires
  app.use('/issues', createService(options));

  // Get our initialized service so that we can register hooks and filters
  const service = app.service('issues');

  service.hooks(hooks);
};
