// Initializes the `articles-recommendations` service on path `/articles-recommendations`
const { ArticlesRecommendations } = require('./articles-recommendations.class');
const hooks = require('./articles-recommendations.hooks');

export default function (app) {
  const options = {
    recommenderServiceUrl: app.get('recommender').articles.endpoint,
  };

  // Initialize our service with any options it requires
  app.use('/articles-recommendations', new ArticlesRecommendations(options));

  // Get our initialized service so that we can register hooks
  const service = app.service('articles-recommendations');

  service.hooks(hooks);
};
