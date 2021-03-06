// Initializes the `issues-timelines` service on path `/issues-timelines`
const createService = require('./issues-timelines.class.js');
const hooks = require('./issues-timelines.hooks');

module.exports = function (app) {
  const options = {
    name: 'issues-timelines',
    app,
  };

  // Initialize our service with any options it requires
  app.use('/issues-timelines', createService(options));

  // Get our initialized service so that we can register hooks
  const service = app.service('issues-timelines');

  service.hooks(hooks);
};
