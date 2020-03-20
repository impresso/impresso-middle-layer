const { Stats } = require('./stats.class');
const hooks = require('./stats.hooks');

module.exports = function (app) {
  app.use('/stats', new Stats(app));
  app.service('stats').hooks(hooks);
};
