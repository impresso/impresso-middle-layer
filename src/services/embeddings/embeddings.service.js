// Initializes the `embeddings` service on path `/embeddings`
const createService = require('./embeddings.class.js');
const hooks = require('./embeddings.hooks');

module.exports = function (app) {
  // Initialize our service with any options it requires
  app.use('/embeddings', createService({
    app,
    name: 'embeddings',
  }));

  // Get our initialized service so that we can register hooks
  const service = app.service('embeddings');

  service.hooks(hooks);
};
