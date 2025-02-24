// Initializes the `articles-suggestions` service on path `/articles-suggestions`
import { ArticlesSuggestionsService } from './articles-suggestions.class'
const hooks = require('./articles-suggestions.hooks')

module.exports = function (app) {
  // Initialize our service with any options it requires
  app.use('/articles-suggestions', new ArticlesSuggestionsService({ solr: app.service('simpleSolrClient') }))

  // Get our initialized service so that we can register hooks
  const service = app.service('articles-suggestions')

  service.hooks(hooks)
}
