// Initializes the `newspapers` service on path `/newspapers`
const createService = require('./newspapers.class');
const hooks = require('./newspapers.hooks');


module.exports = function (app) {
  const options = {
    name: 'newspapers',
    app,
  };

  // Initialize our service with any options it requires
  app.use('/newspapers', createService(options));

  // Get our initialized service so that we can register hooks and filters
  const service = app.service('newspapers');

  service.hooks(hooks);
};
