import { ServiceOptions } from '@feathersjs/feathers'
import { createSwaggerServiceOptions } from 'feathers-swagger'
import { optionsDisabledInPublicApi } from '@/hooks/public-api.js'
import { ImpressoApplication } from '@/types.js'
import { getDocs } from './collectable-items.schema.js'
import { CollectableItemsService as Service } from './collectable-items.class.js'
import hooks from './collectable-items.hooks.js'

export default (app: ImpressoApplication) => {
  const service = new Service(app)

  const options = app.get('isPublicApi')
    ? ({
        events: [],
        methods: ['patch', 'create'],
        docs: createSwaggerServiceOptions({
          schemas: {},
          docs: getDocs(true),
        }),
      } as ServiceOptions)
    : {
        ...optionsDisabledInPublicApi(app),
      }

  app.use('/collections/:collection_id/items', service, options)
  app.service('/collections/:collection_id/items').hooks(hooks)
}
