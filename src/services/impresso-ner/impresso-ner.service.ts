import { ServiceOptions } from '@feathersjs/feathers'
import { createSwaggerServiceOptions } from 'feathers-swagger'
import { ImpressoApplication } from '../../types'
import { ImpressoNerService } from './impresso-ner.class'
import hooks from './impresso-ner.hooks'
import { docs } from './impresso-ner.schema'

export default (app: ImpressoApplication) => {
  const url = app.get('impressoNerServiceUrl') ?? 'https://impresso-annotation.epfl.ch/api/ner/'
  const service = new ImpressoNerService({ impressoNerServiceUrl: url })

  app.use('/tools/ner', service, {
    events: [],
    methods: ['create'],
    docs: createSwaggerServiceOptions({ schemas: {}, docs }),
  } as ServiceOptions)
  app.service('/tools/ner').hooks(hooks)
}
