// Initializes the `entities-suggestions` service on path `/entities-suggestions`
const { EntitiesSuggestions } = require('./entities-suggestions.class');
const hooks = require('./entities-suggestions.hooks');

module.exports = function (app) {
  // Initialize our service with any options it requires
  app.use('/entities-suggestions', new EntitiesSuggestions(app));

  // Get our initialized service so that we can register hooks
  const service = app.service('entities-suggestions');

  service.hooks(hooks);
};
