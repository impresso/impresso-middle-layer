import { NgramTrends } from '@/services/ngram-trends/ngram-trends.class.js'
import hooks from '@/services/ngram-trends/ngram-trends.hooks.js'

export default function (app) {
  const service = new NgramTrends()
  app.use('/ngram-trends', service)
  app.service('ngram-trends').hooks(hooks)
  service.setup(app)
}
