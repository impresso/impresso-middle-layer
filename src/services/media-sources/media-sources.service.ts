import { createSwaggerServiceOptions } from '@/util/feathers.js'
import { ImpressoApplication } from '@/types.js'
import { MediaSources } from '@/services/media-sources/media-sources.class.js'
import hooks from '@/services/media-sources/media-sources.hooks.js'
import { getDocs } from '@/services/media-sources/media-sources.schema.js'
import { ServiceOptions } from '@feathersjs/feathers'

export default async function (app: ImpressoApplication) {
  const isPublicApi = app.get('isPublicApi') ?? false

  app.use('/media-sources', new MediaSources(app.get('cacheManager')), {
    events: [],
    docs: createSwaggerServiceOptions({ schemas: {}, docs: getDocs(isPublicApi) }),
  } as ServiceOptions)
  app.service('media-sources').hooks(hooks)
}
