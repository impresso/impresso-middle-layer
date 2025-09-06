// Initializes the `pages-timelines` service on path `/pages-timelines`
import createService from './pages-timelines.class.js'
import hooks from './pages-timelines.hooks'

export default function (app) {
  const options = {
    name: 'pages-timelines',
    app,
  }

  // Initialize our service with any options it requires
  app.use('/pages-timelines', createService(options))

  // Get our initialized service so that we can register hooks
  const service = app.service('pages-timelines')

  service.hooks(hooks)
}
