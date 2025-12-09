// Initializes the `issues-timelines` service on path `/issues-timelines`
import createService from './issues-timelines.class.js'
import hooks from './issues-timelines.hooks'

export default function (app) {
  const options = {
    name: 'issues-timelines',
    app,
  }

  // Initialize our service with any options it requires
  app.use('/issues-timelines', createService(options))

  // Get our initialized service so that we can register hooks
  const service = app.service('issues-timelines')

  service.hooks(hooks)
}
