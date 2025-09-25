// Initializes the `table-of-contents` service on path `/table-of-contents`
import createService from './table-of-contents.class.js'
import hooks from './table-of-contents.hooks'

export default function (app) {
  const paginate = app.get('paginate')

  const options = {
    paginate,
    app,
    name: 'table-of-contents',
  }

  // Initialize our service with any options it requires
  app.use('/table-of-contents', createService(options))

  // Get our initialized service so that we can register hooks
  const service = app.service('table-of-contents')

  service.hooks(hooks)
}
