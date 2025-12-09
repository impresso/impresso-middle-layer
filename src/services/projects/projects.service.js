// Initializes the `projects` service on path `/projects`
import Decypher from 'decypher'

import createService from './projects.class.js'
import hooks from './projects.hooks'

const queries = Decypher(`${__dirname}/projects.queries.cyp`)

export default function (app) {
  const paginate = app.get('paginate')

  const options = {
    name: 'projects',
    paginate,

    config: app.get('neo4j'),
    queries,
  }

  // Initialize our service with any options it requires
  app.use('/projects', createService(options))

  // Get our initialized service so that we can register hooks and filters
  const service = app.service('projects')

  service.hooks(hooks)
}
