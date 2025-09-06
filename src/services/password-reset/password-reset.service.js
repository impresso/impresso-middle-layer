const Service = require('./password-reset.class')
const hooks = require('./password-reset.hooks')

export default function (app) {
  app.use('/password-reset', new Service({ app }))
  app.service('password-reset').hooks(hooks)
}
