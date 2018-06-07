// Initializes the `projects` service on path `/projects`
const createService = require('./projects.class.js');
const hooks = require('./projects.hooks');
const queries = require('decypher')(__dirname + '/projects.queries.cyp');


module.exports = function(app) {

  const paginate = app.get('paginate');

  const options = {
    name: 'projects',
    paginate,

    config: app.get('neo4j'),
    queries: queries,
  };

  // Initialize our service with any options it requires
  app.use('/projects', createService(options));

  // Get our initialized service so that we can register hooks and filters
  const service = app.service('projects');

  service.hooks(hooks);
};
