// Initializes the `search-queries-comparison` service on path `/search-queries-comparison`
import { SearchQueriesComparison } from './search-queries-comparison.class'
import hooks from './search-queries-comparison.hooks'

export default function (app) {
  const service = new SearchQueriesComparison()
  app.use('/search-queries-comparison', service)
  app.service('search-queries-comparison').hooks(hooks)
  service.setup(app)
}
