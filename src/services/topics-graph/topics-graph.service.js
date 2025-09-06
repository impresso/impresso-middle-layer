// Initializes the `topics-graph` service on path `/topics-graph`
import { TopicsGraph } from './topics-graph.class'
import hooks from './topics-graph.hooks'

export default function (app) {
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
