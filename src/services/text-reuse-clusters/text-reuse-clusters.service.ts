import { createSwaggerServiceOptions } from 'feathers-swagger'
import { TextReuseClusters } from './text-reuse-clusters.class'
import hooks from './text-reuse-clusters.hooks'
import { getDocs } from './text-reuse-clusters.schema'
import { ImpressoApplication } from '../../types'
import { ServiceOptions } from '@feathersjs/feathers'

const init = (app: ImpressoApplication) => {
  const isPublicApi = app.get('isPublicApi') ?? false

  app.use('/text-reuse-clusters', new TextReuseClusters(app), {
    events: [],
    docs: createSwaggerServiceOptions({ schemas: {}, docs: getDocs(isPublicApi) }),
  } as ServiceOptions)
  app.service('text-reuse-clusters').hooks(hooks)
}

export default init
