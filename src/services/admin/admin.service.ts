import { ServiceOptions } from '@feathersjs/feathers'
import { createSwaggerServiceOptions } from 'feathers-swagger'
import { ImpressoApplication } from '../../types'
import { Service } from './admin.class'
import { getDocs } from './admin.schema'

export default (app: ImpressoApplication) => {
  app.use('/admin', new Service(app), {
    events: [],
    docs: createSwaggerServiceOptions({ schemas: {}, docs: getDocs() }),
  } as ServiceOptions)
}
