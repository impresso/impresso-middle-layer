const { ArticlesTextReusePassages } = require('./articles-text-reuse-passages.class');
const hooks = require('./articles-text-reuse-passages.hooks');

export default function (app) {
  const options = {};

  app.use('/articles/:articleId/text-reuse-passages', new ArticlesTextReusePassages(options, app));
  app.service('articles/:articleId/text-reuse-passages').hooks(hooks);
};
