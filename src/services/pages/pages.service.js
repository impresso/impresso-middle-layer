// Initializes the `pages` service on path `/pages`
import createService from '@/services/pages/pages.class.js'
import hooks from '@/services/pages/pages.hooks.js'

export default async function (app) {
  // Initialize our service with any options it requires
  app.use(
    '/pages',
    await createService({
      name: 'pages',
      app,
    })
  )

  // Get our initialized service so that we can register hooks and filters
  const service = app.service('pages')

  service.hooks(hooks)
}
