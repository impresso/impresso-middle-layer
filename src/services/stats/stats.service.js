const { TemporalStats } = require('./stats.class');
const hooks = require('./stats.hooks');

module.exports = function (app) {
  app.use('/stats', new TemporalStats(app));
  app.service('stats').hooks(hooks);
};
