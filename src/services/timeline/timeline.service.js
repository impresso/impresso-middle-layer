// Initializes the `timeline` service on path `/timeline`
const createService = require('./timeline.class.js');
const hooks = require('./timeline.hooks');

module.exports = function () {
  const app = this;
  const paginate = app.get('paginate');

  const options = {
    name: 'timeline',
    paginate,
    run: app.get('neo4jSessionRunner')
  };

  // Initialize our service with any options it requires
  app.use('/timeline', createService(options));

  // Get our initialized service so that we can register hooks and filters
  const service = app.service('timeline');

  service.hooks(hooks);
};
