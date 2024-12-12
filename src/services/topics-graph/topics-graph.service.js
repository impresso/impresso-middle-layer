// Initializes the `topics-graph` service on path `/topics-graph`
const { TopicsGraph } = require('./topics-graph.class')
const hooks = require('./topics-graph.hooks')

module.exports = function (app) {
  // Initialize our service with any options it requires
  app.use(
    '/topics-graph',
    new TopicsGraph(
      {
        paginate: app.get('paginate'),
        name: 'topics-graph',
      },
      app
    )
  )

  // Get our initialized service so that we can register hooks
  const service = app.service('topics-graph')
  service.setup(app)

  service.hooks(hooks)
}
