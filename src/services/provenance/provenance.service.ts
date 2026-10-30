import { createSwaggerServiceOptions } from '@/util/feathers.js'
import type { ImpressoApplication } from '@/types.js'
import { ProvenanceService } from './provenance.class.js'
import hooks from './provenance.hooks.js'
import { docs, schemas } from './provenance.schema.js'
import type { ServiceOptions } from '@feathersjs/feathers'

export default function provenance(app: ImpressoApplication) {
  const options: ServiceOptions & { docs: ReturnType<typeof createSwaggerServiceOptions> } = {
    methods: ['create'],
    events: [],
    docs: createSwaggerServiceOptions({ schemas, docs }),
  }
  app.use('/tools/provenance', new ProvenanceService(app), options)
  app.service('tools/provenance').hooks(hooks)
}
