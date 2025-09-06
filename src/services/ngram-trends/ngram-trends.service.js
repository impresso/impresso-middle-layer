import { NgramTrends } from './ngram-trends.class'
import hooks from './ngram-trends.hooks'

export default function (app) {
  const service = new NgramTrends()
  app.use('/ngram-trends', service)
  app.service('ngram-trends').hooks(hooks)
  service.setup(app)
}
