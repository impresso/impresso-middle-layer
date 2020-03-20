// Initializes the `temporal-stats` service on path `/temporal-stats`
const { TemporalStats } = require('./temporal-stats.class');
const hooks = require('./temporal-stats.hooks');

module.exports = function (app) {
  app.use('/temporal-stats', new TemporalStats(app));
  app.service('temporal-stats').hooks(hooks);
};
