// Initializes the `topics-related` service on path `/topics-related`
const { TopicsRelated } = require('./topics-related.class');
const hooks = require('./topics-related.hooks');

module.exports = function (app) {
  // Initialize our service with any options it requires
  app.use('/topics-related', new TopicsRelated({
    paginate: app.get('paginate'),
    name: 'topics-related',
  }, app));

  // Get our initialized service so that we can register hooks
  const service = app.service('topics-related');

  service.hooks(hooks);
};
