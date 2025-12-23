import { ServiceOptions } from '@feathersjs/feathers'
import { createSwaggerServiceOptions } from 'feathers-swagger'
import { ImpressoApplication } from '@/types.js'
import { ImpressoNerService } from './impresso-ner.class.js'
import hooks from './impresso-ner.hooks.js'
import { docs } from './impresso-ner.schema.js'

export default (app: ImpressoApplication) => {
  const url = app.get('impressoNerServiceUrl') ?? 'https://impresso-annotation.epfl.ch/api'
  const service = new ImpressoNerService({ impressoNerServiceBaseUrl: url })

  app.use('/tools/ner', service, {
    events: [],
    methods: ['create'],
    docs: createSwaggerServiceOptions({ schemas: {}, docs }),
  } as ServiceOptions)
  app.service('/tools/ner').hooks(hooks)
}
