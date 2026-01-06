// Initializes the `projects` service on path `/projects`
import * as path from 'path'
import { fileURLToPath } from 'url'
import Decypher from 'decypher'

import createService from '@/services/projects/projects.class.js'
import hooks from '@/services/projects/projects.hooks.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const queries = Decypher(path.join(__dirname, 'projects.queries.cyp'))

export default async function (app) {
  const paginate = app.get('paginate')

  const options = {
    name: 'projects',
    paginate,

    config: app.get('neo4j'),
    queries,
  }

  // Initialize our service with any options it requires
  app.use('/projects', await createService(options))

  // Get our initialized service so that we can register hooks and filters
  const service = app.service('projects')

  service.hooks(hooks)
}
