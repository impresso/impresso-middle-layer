// Initializes the `search-queries-comparison` service on path `/search-queries-comparison`
const { SearchQueriesComparison } = require('./search-queries-comparison.class')
const hooks = require('./search-queries-comparison.hooks')

export default function (app) {
  const service = new SearchQueriesComparison()
  app.use('/search-queries-comparison', service)
  app.service('search-queries-comparison').hooks(hooks)
  service.setup(app)
}
