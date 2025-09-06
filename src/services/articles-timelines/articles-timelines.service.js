// Initializes the `articles-timelines` service on path `/articles-timelines`
const createService = require('./articles-timelines.class.js');
const hooks = require('./articles-timelines.hooks');

export default function (app) {
  const options = {
    name: 'articles-timelines',
    app,
  };

  // Initialize our service with any options it requires
  app.use('/articles-timelines', createService(options));

  // Get our initialized service so that we can register hooks
  const service = app.service('articles-timelines');

  service.hooks(hooks);
};
