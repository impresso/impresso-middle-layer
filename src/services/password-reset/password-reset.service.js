import Service from './password-reset.class'
import hooks from './password-reset.hooks'

export default function (app) {
  app.use('/password-reset', new Service({ app }))
  app.service('password-reset').hooks(hooks)
}
