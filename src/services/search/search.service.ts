import { createSwaggerServiceOptions } from 'feathers-swagger'
import { getDocs } from '@/services/search/search.schema.js'
import { ImpressoApplication } from '@/types.js'
import { Service } from '@/services/search/search.class.js'
import { ServiceOptions } from '@feathersjs/feathers'
import hooks from '@/services/search/search.hooks.js'

const init = async (app: ImpressoApplication) => {
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
