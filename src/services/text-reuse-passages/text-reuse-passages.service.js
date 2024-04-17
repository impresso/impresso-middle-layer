import { createSwaggerServiceOptions } from 'feathers-swagger'
import { TextReusePassages as TextReusePassagesService } from './text-reuse-passages.class'
import hooks from './text-reuse-passages.hooks'
import { docs } from './text-reuse-passages.schema'

module.exports = function (app) {
  app.use('/text-reuse-passages', new TextReusePassagesService(app), {
    events: [],
    docs: createSwaggerServiceOptions({ schemas: {}, docs }),
  })
  app.service('text-reuse-passages').hooks(hooks)
}
