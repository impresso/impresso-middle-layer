// Initializes the `jobs` service on path `/jobs`
const createService = require('./jobs.class.js');
const hooks = require('./jobs.hooks');

module.exports = function (app) {

  // Initialize our service with any options it requires
  app.use('/jobs', createService({
    name: 'jobs',
    app,
  }));

  // Get our initialized service so that we can register hooks
  const service = app.service('jobs');


  service.hooks(hooks);
};
