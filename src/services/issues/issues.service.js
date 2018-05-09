// Initializes the `issues` service on path `/issues`
const createService = require('../neo4j.service');
const hooks = require('./issues.hooks');

module.exports = function (app) {

  const paginate = app.get('paginate');

  const options = {
    name: 'issues',
    paginate,
    config: app.get('neo4j')
  };

  // Initialize our service with any options it requires
  app.use('/issues', createService(options));

  // Get our initialized service so that we can register hooks and filters
  const service = app.service('issues');

  service.hooks(hooks);
};
