import { ServiceOptions } from '@feathersjs/feathers'
import { createSwaggerServiceOptions } from '@/util/feathers.js'
import { ImpressoApplication } from '@/types.js'
import { FilterSerializationService } from './filter-serialization.class.js'
import hooks from './filter-serialization.hooks.js'
import { docs } from './filter-serialization.schema.js'

export default (app: ImpressoApplication) => {
  app.use('/tools/filters/serialize', new FilterSerializationService(), {
    events: [],
    methods: ['create'],
    docs: createSwaggerServiceOptions({ schemas: {}, docs }),
  } as ServiceOptions)
  app.service('/tools/filters/serialize').hooks(hooks)
}
