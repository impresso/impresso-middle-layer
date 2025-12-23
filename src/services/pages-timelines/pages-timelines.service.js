// Initializes the `pages-timelines` service on path `/pages-timelines`
import createService from '@/services/pages-timelines/pages-timelines.class.js'
import hooks from '@/services/pages-timelines/pages-timelines.hooks.js'

export default async function (app) {
  const options = {
    name: 'pages-timelines',
    app,
  }

  // Initialize our service with any options it requires
  app.use('/pages-timelines', await createService(options))

  // Get our initialized service so that we can register hooks
  const service = app.service('pages-timelines')

  service.hooks(hooks)
}
