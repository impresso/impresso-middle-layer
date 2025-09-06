// Initializes the `articles-recommendations` service on path `/articles-recommendations`
import { ArticlesRecommendations } from './articles-recommendations.class'
import hooks from './articles-recommendations.hooks'

export default function (app) {
  const options = {
    recommenderServiceUrl: app.get('recommender').articles.endpoint,
  }

  // Initialize our service with any options it requires
  app.use('/articles-recommendations', new ArticlesRecommendations(options))

  // Get our initialized service so that we can register hooks
  const service = app.service('articles-recommendations')

  service.hooks(hooks)
}
