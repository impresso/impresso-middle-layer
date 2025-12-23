import { createSwaggerServiceOptions } from 'feathers-swagger'
import { TextReusePassages as TextReusePassagesService } from '@/services/text-reuse-passages/text-reuse-passages.class.js'
import hooks from '@/services/text-reuse-passages/text-reuse-passages.hooks.js'
import { getDocs } from '@/services/text-reuse-passages/text-reuse-passages.schema.js'
import { ImpressoApplication } from '@/types.js'
import { ServiceOptions } from '@feathersjs/feathers'

export default function (app: ImpressoApplication) {
  const isPublicApi = app.get('isPublicApi') ?? false

  app.use('/text-reuse-passages', new TextReusePassagesService(app), {
    events: [],
    docs: createSwaggerServiceOptions({ schemas: {}, docs: getDocs(isPublicApi) }),
  } as ServiceOptions)
  app.service('text-reuse-passages').hooks(hooks)
}
