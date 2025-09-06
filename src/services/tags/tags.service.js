// Initializes the `tags` service on path `/tags`
import createService from './tags.class.js'
import hooks from './tags.hooks'

export default function (app) {
  const paginate = app.get('paginate')

  const options = {
    name: 'tags',
    paginate,
    app,
  }

  // Initialize our service with any options it requires
  app.use('/tags', createService(options))

  // Get our initialized service so that we can register hooks
  const service = app.service('tags')

  service.hooks(hooks)
}
