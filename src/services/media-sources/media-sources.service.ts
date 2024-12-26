import { createSwaggerServiceOptions } from 'feathers-swagger'
import { ImpressoApplication } from '../../types'
import { MediaSources } from './media-sources.class'
import hooks from './media-sources.hooks'
import { getDocs } from './media-sources.schema'
import { ServiceOptions } from '@feathersjs/feathers'

export default function (app: ImpressoApplication) {
  const isPublicApi = app.get('isPublicApi') ?? false

  app.use('/media-sources', new MediaSources(app.get('cacheManager')), {
    events: [],
    docs: createSwaggerServiceOptions({ schemas: {}, docs: getDocs(isPublicApi) }),
  } as ServiceOptions)
  app.service('media-sources').hooks(hooks)
}
