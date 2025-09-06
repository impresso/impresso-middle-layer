const { Stats } = require('./stats.class');
const hooks = require('./stats.hooks');

export default function (app) {
  app.use('/stats', new Stats(app));
  app.service('stats').hooks(hooks);
};
