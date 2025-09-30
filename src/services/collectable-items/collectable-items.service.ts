import { ServiceOptions } from '@feathersjs/feathers'
import { createSwaggerServiceOptions } from 'feathers-swagger'
import { optionsDisabledInPublicApi } from '../../hooks/public-api'
import { ImpressoApplication } from '../../types'
import { getDocs } from './collectable-items.schema'
// import { Service } from './collectable-items.class.deprecated'
// import hooks from './collectable-items.hooks.deprecated'
import { CollectableItemsService as Service } from './collectable-items.class'
import hooks from './collectable-items.hooks'

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
