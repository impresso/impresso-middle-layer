import { createSwaggerServiceOptions } from 'feathers-swagger'
import { TextReusePassages as TextReusePassagesService } from './text-reuse-passages.class'
import hooks from './text-reuse-passages.hooks'
import { getDocs } from './text-reuse-passages.schema'

module.exports = function (app) {
  const isPublicApi = app.get('isPublicApi')

  app.use('/text-reuse-passages', new TextReusePassagesService(app), {
    events: [],
    docs: createSwaggerServiceOptions({ schemas: {}, docs: getDocs(isPublicApi) }),
  })
  app.service('text-reuse-passages').hooks(hooks)
}
