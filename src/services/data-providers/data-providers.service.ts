import { createSwaggerServiceOptions } from 'feathers-swagger'
import { getDocs } from './data-providers.schema'
import { DataProviders } from './data-providers.class'
import { ImpressoApplication } from '../../types'
import { ServiceOptions } from '@feathersjs/feathers'
import hooks from './data-providers.hooks'

export default function (app: ImpressoApplication) {
  const isPublicApi = app.get('isPublicApi') ?? false

  // Initialize our service with any options it requires
  app.use('/data-providers', new DataProviders(), {
    events: [],
    docs: createSwaggerServiceOptions({ schemas: {}, docs: getDocs(isPublicApi) }),
  } as ServiceOptions)

  app.service('data-providers').hooks(hooks)
}
