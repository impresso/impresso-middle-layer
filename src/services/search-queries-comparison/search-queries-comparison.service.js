// Initializes the `search-queries-comparison` service on path `/search-queries-comparison`
import { SearchQueriesComparison } from '@/services/search-queries-comparison/search-queries-comparison.class.js'
import hooks from '@/services/search-queries-comparison/search-queries-comparison.hooks.js'

export default async function (app) {
  const service = new SearchQueriesComparison()
  app.use('/search-queries-comparison', service)
  app.service('search-queries-comparison').hooks(hooks)
  await service.setup(app)
}
