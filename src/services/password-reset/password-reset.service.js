import Service from '@/services/password-reset/password-reset.class.js'
import hooks from '@/services/password-reset/password-reset.hooks.js'

export default async function (app) {
  app.use('/password-reset', new Service({ app }))
  app.service('password-reset').hooks(hooks)
}
