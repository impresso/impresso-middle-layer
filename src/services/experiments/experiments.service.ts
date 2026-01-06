import { createSwaggerServiceOptions } from '@/util/feathers.js'
import { ImpressoApplication } from '@/types.js'
import { Experiments } from './experiments.class.js'
import hooks from './experiments.hooks.js'
import { getDocs } from './experiments.schema.js'
import { ServiceOptions } from '@feathersjs/feathers'

export default function (app: ImpressoApplication) {
  const isPublicApi = app.get('isPublicApi') ?? false

  app.use('/experiments', new Experiments(app), {
    events: [],
    docs: createSwaggerServiceOptions({ schemas: {}, docs: getDocs(isPublicApi) }),
  } as ServiceOptions)
  app.service('experiments').hooks(hooks)
}
