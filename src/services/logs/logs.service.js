// Initializes the `logs` service on path `/logs`
const createService = require('./logs.class.js');
const hooks = require('./logs.hooks');

module.exports = function (app) {

  const options = {
    name: 'logs',
    app,
  };

  // Initialize our service with any options it requires
  app.use('/logs', createService(options));

  // Get our initialized service so that we can register hooks
  const service = app.service('logs');

  service.hooks(hooks);
};
