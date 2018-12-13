// Initializes the `topics` service on path `/topics`
const createService = require('./topics.class.js');
const hooks = require('./topics.hooks');

module.exports = function (app) {

  const paginate = app.get('paginate');

  const options = {
    name: 'topics',
    paginate,
    app,
  };

  // Initialize our service with any options it requires
  app.use('/topics', createService(options));

  // Get our initialized service so that we can register hooks
  const service = app.service('topics');

  service.hooks(hooks);
};
