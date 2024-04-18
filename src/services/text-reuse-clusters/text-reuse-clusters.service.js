import { createSwaggerServiceOptions } from 'feathers-swagger'
import { TextReuseClusters } from './text-reuse-clusters.class'
import hooks from './text-reuse-clusters.hooks'
import { docs } from './text-reuse-clusters.schema'

module.exports = function (app) {
  const options = {}

  app.use('/text-reuse-clusters', new TextReuseClusters(options, app), {
    events: [],
    docs: createSwaggerServiceOptions({ schemas: {}, docs }),
  })
  app.service('text-reuse-clusters').hooks(hooks)
}
