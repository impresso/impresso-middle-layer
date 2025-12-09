import { ServiceOptions } from '@feathersjs/feathers'
import { createSwaggerServiceOptions } from 'feathers-swagger'
import { ImpressoApplication } from '../../types'
// import ServiceV1 from './images-v1.class'
// import hooksV1 from './images-v1.hooks'
import { Images } from './images.class'
import hooks from './images.hooks'
import { getDocs } from './images.schema'

const init = (app: ImpressoApplication) => {
  const isPublicApi = app.get('isPublicApi') ?? false

  const service = new Images(
    app,
    app.service('simpleSolrClient'),
    app.service('media-sources'),
    app.get('images').rewriteRules ?? []
  )

  app.use('/images', service, {
    events: [],
    docs: createSwaggerServiceOptions({ schemas: {}, docs: getDocs(isPublicApi) }),
  } as ServiceOptions)
  app.service('images').hooks(hooks)
}

export default init
