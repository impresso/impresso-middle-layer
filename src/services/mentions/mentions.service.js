// Initializes the `mentions` service on path `/mentions`
const createService = require('./mentions.class.js');
const hooks = require('./mentions.hooks');

module.exports = function (app) {
  // const paginate = app.get('paginate');
  const options = {
    app,
    name: 'mentions',
  };

  // Initialize our service with any options it requires
  app.use('/mentions', createService(options));

  // Get our initialized service so that we can register hooks
  const service = app.service('mentions');

  service.hooks(hooks);
};
