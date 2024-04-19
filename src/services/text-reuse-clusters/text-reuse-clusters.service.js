import { createSwaggerServiceOptions } from 'feathers-swagger'
import { TextReuseClusters } from './text-reuse-clusters.class'
import hooks from './text-reuse-clusters.hooks'
import { docs } from './text-reuse-clusters.schema'

module.exports = function (app) {
  app.use('/text-reuse-clusters', new TextReuseClusters(app), {
    events: [],
    docs: createSwaggerServiceOptions({ schemas: {}, docs }),
  })
  app.service('text-reuse-clusters').hooks(hooks)
}
