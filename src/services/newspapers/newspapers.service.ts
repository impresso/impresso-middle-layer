import { createSwaggerServiceOptions } from 'feathers-swagger'
import { getDocs } from './newspapers.schema'
import { NewspapersService } from './newspapers.class'
import { ImpressoApplication } from '../../types'
import { ServiceOptions } from '@feathersjs/feathers'
import hooks from './newspapers.hooks'

/**
 * @deprecated Use the `media-sources` service instead.
 * This service is only kept for backward compatibility
 * in the web app.
 */
export default function (app: ImpressoApplication) {
  const isPublicApi = app.get('isPublicApi') ?? false

  // Initialize our service with any options it requires
  app.use('/newspapers', new NewspapersService(app), {
    events: [],
    docs: createSwaggerServiceOptions({ schemas: {}, docs: getDocs(isPublicApi) }),
  } as ServiceOptions)

  app.service('newspapers').hooks(hooks)
}
