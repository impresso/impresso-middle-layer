// Initializes the `table-of-contents` service on path `/table-of-contents`
const createService = require('./table-of-contents.class.js');
const hooks = require('./table-of-contents.hooks');

module.exports = function (app) {
  const paginate = app.get('paginate');

  const options = {
    paginate,
    app,
    name: 'table-of-contents',
  };

  // Initialize our service with any options it requires
  app.use('/table-of-contents', createService(options));

  // Get our initialized service so that we can register hooks
  const service = app.service('table-of-contents');

  service.hooks(hooks);
};
