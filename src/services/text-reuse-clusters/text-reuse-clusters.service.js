const { TextReuseClusters } = require('./text-reuse-clusters.class');
const hooks = require('./text-reuse-clusters.hooks');

module.exports = function (app) {
  const options = {};

  app.use('/text-reuse-clusters', new TextReuseClusters(options, app));
  app.service('text-reuse-clusters').hooks(hooks);
};
