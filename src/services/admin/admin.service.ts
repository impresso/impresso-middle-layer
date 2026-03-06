import { ServiceOptions } from '@feathersjs/feathers'
import { createSwaggerServiceOptions } from '@/util/feathers.js'
import { ImpressoApplication } from '@/types.js'
import { Service } from './admin.class.js'
import { getDocs } from './admin.schema.js'
import hooks from './admin.hooks.js'

export default (app: ImpressoApplication) => {
  app.use('/admin', new Service(app), {
    events: [],
    methods: ['find', 'patch'],
    docs: createSwaggerServiceOptions({ schemas: {}, docs: getDocs() }),
  } as ServiceOptions)
  app.service('admin').hooks(hooks)
}
