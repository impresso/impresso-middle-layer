import { createSwaggerServiceOptions } from 'feathers-swagger'
import { getDocs } from './search.schema'
import { ImpressoApplication } from '../../types'
import { Service } from './search.class'
import { ServiceOptions } from '@feathersjs/feathers'
import hooks from './search.hooks'

const init = (app: ImpressoApplication) => {
  const isPublicApi = app.get('isPublicApi') ?? false

  const service = new Service(app)

  app.use('/search', service, {
    methods: isPublicApi ? ['find'] : undefined,
    events: [],
    docs: createSwaggerServiceOptions({ schemas: {}, docs: getDocs(isPublicApi) }),
  } as ServiceOptions)

  app.service('search').hooks(hooks)
}

export default init
