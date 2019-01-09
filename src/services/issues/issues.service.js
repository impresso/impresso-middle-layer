// Initializes the `issues` service on path `/issues`
const createService = require('./issues.class');
const hooks = require('./issues.hooks');

module.exports = function (app) {
  const paginate = app.get('paginate');

  const options = {
    name: 'issues',
    paginate,
    app,
  };

  // Initialize our service with any options it requires
  app.use('/issues', createService(options));

  // Get our initialized service so that we can register hooks and filters
  const service = app.service('issues');

  service.hooks(hooks);
};
