import { createSwaggerServiceOptions } from '@/util/feathers.js'
import { TextReuseClusters } from '@/services/text-reuse-clusters/text-reuse-clusters.class.js'
import hooks from '@/services/text-reuse-clusters/text-reuse-clusters.hooks.js'
import { getDocs } from '@/services/text-reuse-clusters/text-reuse-clusters.schema.js'
import { ImpressoApplication } from '@/types.js'
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
