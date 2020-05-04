// Initializes the `filters-items` service on path `/filters-items`
const { FiltersItems } = require('./filters-items.class');
const hooks = require('./filters-items.hooks');

module.exports = function (app) {
  app.use('/filters-items', new FiltersItems(app));
  app.service('filters-items').hooks(hooks);
};
