import { ServiceOptions } from '@feathersjs/feathers'
import { createSwaggerServiceOptions } from 'feathers-swagger'
import { ImpressoApplication } from '../../types'
import { docs } from './articles.schema'
import createService from './articles.class'

// Initializes the `articles` service on path `/articles`
const hooks = require('./articles.hooks')

export default function (app: ImpressoApplication) {
  const paginate = app.get('paginate')

  /**
   * Even though the service is historically called 'articles'
   * it technically deals with content items. We keep the original prefix
   * for the internal use (web app), but expose it as 'content-items' for the public API.
   */
  const prefix = app.get('isPublicApi') ? '/content-items' : '/articles'

  const options = {
    name: 'articles',
    paginate,
    app,
  }

  const svc = createService(options)

  // Initialize our service with any options it requires
  app.use('/content-items', svc, {
    events: [],
    methods: ['get'],
    docs: createSwaggerServiceOptions({ schemas: {}, docs }),
  } as ServiceOptions)

  // Get our initialized service so that we can register hooks and filters
  const service = app.service('content-items')

  service.hooks(hooks)

  if (!app.get('isPublicApi')) {
    // Expose the service as 'articles' for the web app
    app.use('/articles', service)
  }
}
