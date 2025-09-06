// Initializes the `init` service on path `/init`
import createService from './init.class.js'
import hooks from './init.hooks'

export default function (app) {
  const paginate = app.get('paginate')

  const options = {
    name: 'init',
    paginate,
    app,
  }

  // Initialize our service with any options it requires
  app.use('/init', createService(options))

  // Get our initialized service so that we can register hooks
  const service = app.service('init')

  service.hooks(hooks)
}
