import { ServiceOptions } from '@feathersjs/feathers'
import { createSwaggerServiceOptions } from 'feathers-swagger'
import { optionsDisabledInPublicApi } from '../../hooks/public-api'
import { ImpressoApplication } from '../../types'
import { Service } from './collectable-items.class'
import hooks from './collectable-items.hooks'
import { docs } from './collectable-items.schema'

export default (app: ImpressoApplication) => {
  const service = new Service(app)

  // enable service on the top level endpoint for internal use
  app.use('/collectable-items', service, {
    ...optionsDisabledInPublicApi(app),
  })
  app.service('collectable-items').hooks(hooks)

  // enable the service on the nested endpoint for Public API
  if (app.get('isPublicApi')) {
    app.use('/collections/:collection_id/items', service, {
      events: [],
      methods: ['patch'],
      docs: createSwaggerServiceOptions({
        schemas: {},
        docs,
      }),
    } as ServiceOptions)
    app.service('/collections/:collection_id/items').hooks(hooks)
  }
}
