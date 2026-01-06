import { Stats } from '@/services/stats/stats.class.js'
import hooks from '@/services/stats/stats.hooks.js'

export default function (app) {
  app.use('/stats', new Stats(app))
  app.service('stats').hooks(hooks)
}
