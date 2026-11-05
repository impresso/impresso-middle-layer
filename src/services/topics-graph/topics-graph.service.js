/**
 * Initializes the `topics-graph` service on path `/topics-graph`
 *
 * ===========================================================================
 *
 *  ██  DEPRECATED — DO NOT USE — SCHEDULED FOR REMOVAL  ██
 *
 * The `/topics-graph` service is DEPRECATED.
 *
 * The topics well-known cache (see `src/useCases/prepareTopics.ts`) no longer
 * stores related topics or precomputed graph metrics (x/y positions,
 * pagerank, community, hub, authority). As a result the unfiltered `find()`
 * overview returns degenerate nodes (position {x:0, y:0}, pagerank 0) with
 * no links, and this service must be considered dead code.
 *
 * Do NOT use it for new code, do NOT extend it, and do NOT build new
 * features on top of it.
 *
 * ===========================================================================
 */
import { getLogger } from '@/logger.js'
import { TopicsGraph } from '@/services/topics-graph/topics-graph.class.js'
import hooks from '@/services/topics-graph/topics-graph.hooks.js'

const logger = getLogger(['impresso', 'services', 'topics-graph'])

export default function (app) {
  logger.warn(
    'DEPRECATED: /topics-graph is deprecated and scheduled for removal. ' +
      'The topics cache no longer provides related topics or graph metrics; ' +
      'do not use this service for new code.'
  )
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
