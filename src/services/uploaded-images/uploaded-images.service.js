// Initializes the `uploaded-images` service on path `/uploaded-images`
const createService = require('./uploaded-images.class.js');
const hooks = require('./uploaded-images.hooks');

module.exports = function (app) {
  // Initialize our service with any options it requires
  app.use('/uploaded-images', createService({
    name: 'uploaded-images',
    app,
  }));

  // Get our initialized service so that we can register hooks
  const service = app.service('uploaded-images');

  service.hooks(hooks);
};
