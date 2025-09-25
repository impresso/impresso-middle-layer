import { Stats } from './stats.class'
import hooks from './stats.hooks'

export default function (app) {
  app.use('/stats', new Stats(app))
  app.service('stats').hooks(hooks)
}
