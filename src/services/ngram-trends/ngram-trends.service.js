const { NgramTrends } = require('./ngram-trends.class');
const hooks = require('./ngram-trends.hooks');

module.exports = function (app) {
  app.use('/ngram-trends', new NgramTrends());
  app.service('ngram-trends').hooks(hooks);
};
