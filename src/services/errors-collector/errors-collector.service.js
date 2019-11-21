const createService = require('./errors-collector.class');
const hooks = require('./errors-collector.hooks');

module.exports = function (app) {
  app.use('/errors-collector', createService());
  app.service('errors-collector').hooks(hooks);
};
