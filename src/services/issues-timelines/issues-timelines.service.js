// Initializes the `issues-timelines` service on path `/issues-timelines`
import createService from '@/services/issues-timelines/issues-timelines.class.js'
import hooks from '@/services/issues-timelines/issues-timelines.hooks.js'

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
