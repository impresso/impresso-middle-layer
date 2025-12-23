import { createSwaggerServiceOptions } from 'feathers-swagger'
import { getDocs } from '@/services/newspapers/newspapers.schema.js'
import { NewspapersService } from '@/services/newspapers/newspapers.class.js'
import { ImpressoApplication } from '@/types.js'
import { ServiceOptions } from '@feathersjs/feathers'
import hooks from '@/services/newspapers/newspapers.hooks.js'

/**
 * @deprecated Use the `media-sources` service instead.
 * This service is only kept for backward compatibility
 * in the web app.
 */
export default async function (app: ImpressoApplication) {
  const isPublicApi = app.get('isPublicApi') ?? false

  // Initialize our service with any options it requires
  app.use('/newspapers', new NewspapersService(app), {
    events: [],
    docs: createSwaggerServiceOptions({ schemas: {}, docs: getDocs(isPublicApi) }),
  } as ServiceOptions)

  app.service('newspapers').hooks(hooks)
}
