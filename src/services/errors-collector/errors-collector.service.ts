import { Application } from '@feathersjs/feathers'
import Service from './errors-collector.class'
import hooks from './errors-collector.hooks'

export default function (app: Application) {
  app.use('/errors-collector', new Service())
  app.service('errors-collector').hooks(hooks)
}
