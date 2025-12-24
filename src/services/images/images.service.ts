import { ServiceOptions } from '@feathersjs/feathers'
import { createSwaggerServiceOptions } from '@/util/feathers.js'
import { ImpressoApplication } from '@/types.js'
// import ServiceV1 from '@/services/images/images-v1.class.js'
// import hooksV1 from '@/services/images/images-v1.hooks.js'
import { Images } from '@/services/images/images.class.js'
import hooks from '@/services/images/images.hooks.js'
import { getDocs } from '@/services/images/images.schema.js'

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
