const { NgramTrends } = require('./ngram-trends.class')
const hooks = require('./ngram-trends.hooks')

module.exports = function (app) {
  const service = new NgramTrends()
  app.use('/ngram-trends', service)
  app.service('ngram-trends').hooks(hooks)
  service.setup(app)
}
