import { Application } from '@feathersjs/feathers'
import Service from './errors-collector.class.js'
import hooks from './errors-collector.hooks.js'

export default function (app: Application) {
  app.use('/errors-collector', new Service())
  app.service('errors-collector').hooks(hooks)
}
