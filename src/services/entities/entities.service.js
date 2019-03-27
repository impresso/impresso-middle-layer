// Initializes the `entities` service on path `/entities`
const createService = require('./entities.class.js');
const hooks = require('./entities.hooks');

module.exports = function (app) {
  // Initialize our service with any options it requires
  app.use('/entities', createService({
    name: 'entities',
    app,
  }));

  // Get our initialized service so that we can register hooks
  const service = app.service('entities');

  service.hooks(hooks);
};
