import { createSwaggerServiceOptions } from 'feathers-swagger'
import { ImpressoApplication } from '../../types'
import { Experiments } from './experiments.class'
import hooks from './experiments.hooks'
import { getDocs } from './experiments.schema'
import { ServiceOptions } from '@feathersjs/feathers'

export default function (app: ImpressoApplication) {
  const isPublicApi = app.get('isPublicApi') ?? false

  app.use('/experiments', new Experiments(app), {
    events: [],
    docs: createSwaggerServiceOptions({ schemas: {}, docs: getDocs(isPublicApi) }),
  } as ServiceOptions)
  app.service('experiments').hooks(hooks)
}
