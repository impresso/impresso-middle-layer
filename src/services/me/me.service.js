// Initializes the `me` service on path `/me`
const createService = require('./me.class.js');
const hooks = require('./me.hooks');

module.exports = function (app) {
  
  const paginate = app.get('paginate');

  const options = {
    paginate
  };

  // Initialize our service with any options it requires
  app.use('/me', createService(options));

  // Get our initialized service so that we can register hooks
  const service = app.service('me');

  service.hooks(hooks);
};
