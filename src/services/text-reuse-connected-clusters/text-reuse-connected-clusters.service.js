// Initializes the `text-reuse-connected-clusters` service on path `/text-reuse-connected-clusters`
const { TextReuseConnectedClusters } = require('./text-reuse-connected-clusters.class');
const hooks = require('./text-reuse-connected-clusters.hooks');

module.exports = function (app) {
  // Initialize our service with any options it requires
  app.use('/text-reuse-connected-clusters', new TextReuseConnectedClusters(app));
  app.service('text-reuse-connected-clusters').hooks(hooks);
};
