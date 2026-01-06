import { ArticlesTextReusePassages } from './articles-text-reuse-passages.class.js'
import hooks from './articles-text-reuse-passages.hooks.js'

export default function (app) {
  const options = {}

  app.use('/articles/:articleId/text-reuse-passages', new ArticlesTextReusePassages(options, app))
  app.service('articles/:articleId/text-reuse-passages').hooks(hooks)
}
