// Initializes the `embeddings` service on path `/embeddings`
const createService = require('./embeddings.class.js');
const hooks = require('./embeddings.hooks');

module.exports = function (app) {
  
  const paginate = app.get('paginate');

  const options = {
    paginate
  };

  // Initialize our service with any options it requires
  app.use('/embeddings', createService(options));

  // Get our initialized service so that we can register hooks
  const service = app.service('embeddings');

  service.hooks(hooks);
};
