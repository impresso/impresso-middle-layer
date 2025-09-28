import { ServiceOptions } from '@feathersjs/feathers'
import { createSwaggerServiceOptions } from 'feathers-swagger'
import { ImpressoApplication } from '../../types'
import ServiceV1 from './images-v1.class'
import hooksV1 from './images-v1.hooks'
import { Images as ServiceV2 } from './images.class'
import hooksV2 from './images.hooks'
import { getDocs } from './images.schema'

const SchemaVersionV2 = 'v2'

const init = (app: ImpressoApplication) => {
  const isPublicApi = app.get('isPublicApi') ?? false
  const schemaVersion = app
    .get('solrConfiguration')
    .namespaces?.find(({ namespaceId }) => namespaceId === 'images')?.schemaVersion

  const isSchemaVersionV2 = schemaVersion === SchemaVersionV2

  const service =
    isSchemaVersionV2 || isPublicApi
      ? new ServiceV2(
          app,
          app.service('simpleSolrClient'),
          app.service('media-sources'),
          app.get('images').rewriteRules ?? []
        )
      : new ServiceV1({
          app,
          name: 'images',
        })
  const hooks = isSchemaVersionV2 ? hooksV2 : hooksV1

  app.use('/images', service, {
    events: [],
    docs: createSwaggerServiceOptions({ schemas: {}, docs: getDocs(isSchemaVersionV2 || isPublicApi) }),
  } as ServiceOptions)
  app.service('images').hooks(hooks)
}

export default init
