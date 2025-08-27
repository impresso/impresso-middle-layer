import { createSwaggerServiceOptions } from 'feathers-swagger'
import { TextReusePassages as TextReusePassagesService } from './text-reuse-passages.class'
import hooks from './text-reuse-passages.hooks'
import { getDocs } from './text-reuse-passages.schema'
import { ImpressoApplication } from '../../types'
import { ServiceOptions } from '@feathersjs/feathers'

module.exports = function (app: ImpressoApplication) {
  const isPublicApi = app.get('isPublicApi') ?? false

  app.use('/text-reuse-passages', new TextReusePassagesService(app), {
    events: [],
    docs: createSwaggerServiceOptions({ schemas: {}, docs: getDocs(isPublicApi) }),
  } as ServiceOptions)
  app.service('text-reuse-passages').hooks(hooks)
}
