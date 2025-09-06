const { TextReuseClusterPassages } = require('./text-reuse-cluster-passages.class');
const hooks = require('./text-reuse-cluster-passages.hooks');

export default function (app) {
  app.use('/text-reuse-cluster-passages', new TextReuseClusterPassages({}, app));
  app.service('text-reuse-cluster-passages').hooks(hooks);
};
