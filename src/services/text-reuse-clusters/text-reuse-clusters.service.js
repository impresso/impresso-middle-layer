import { createSwaggerServiceOptions } from 'feathers-swagger'
import { TextReuseClusters } from './text-reuse-clusters.class'
import hooks from './text-reuse-clusters.hooks'
import { getDocs } from './text-reuse-clusters.schema'

module.exports = function (app) {
  const isPublicApi = app.get('isPublicApi')

  app.use('/text-reuse-clusters', new TextReuseClusters(app), {
    events: [],
    docs: createSwaggerServiceOptions({ schemas: {}, docs: getDocs(isPublicApi) }),
  })
  app.service('text-reuse-clusters').hooks(hooks)
}
