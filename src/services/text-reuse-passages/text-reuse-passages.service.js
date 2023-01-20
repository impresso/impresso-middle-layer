const TextReusePassagesService = require('./text-reuse-passages.class')
const hooks = require('./text-reuse-passages.hooks')

module.exports = function (app) {
  app.use('/text-reuse-passages', new TextReusePassagesService(app))
  app.service('text-reuse-passages').hooks(hooks)
}
