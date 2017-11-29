// Initializes the `entities` service on path `/entities`
const createService = require('./entities.class.js');
const hooks = require('./entities.hooks');
const filters = require('./entities.filters');

module.exports = function () {
  const app = this;
  const paginate = app.get('paginate');

  const options = {
    name: 'entities',
    paginate
  };

  // Initialize our service with any options it requires
  app.use('/entities', createService(options));

  // Get our initialized service so that we can register hooks and filters
  const service = app.service('entities');

  service.hooks(hooks);

  if (service.filter) {
    service.filter(filters);
  }
};
