import { ImpressoApplication } from '../types'
import { logger } from '../logger'

/**
 * Some public services are declared here but are only required internally by
 * other services. Whether a service is available publicly or not is determined
 * in the service files. Look for the `optionsDisabledInPublicApi` method.
 */
const publicApiServices = [
  'search', // search items
  'articles', // get articles
  'users', // required for authentication
  'collectable-items', // required by 'search'
  'collections', // CRUD collections
  'text-reuse-passages',
  'text-reuse-clusters',
  'version',
  'search-facets',
  'entities',
  'impresso-ner',
  'media-sources',
]

const adminServices = ['admin']

const internalApiServices = [
  'issues',
  'suggestions',
  'projects',
  'pages',
  'tags',
  'articles-tags',
  'buckets-items',
  'search-exporter',
  'topics',
  'init',
  'pages-timelines',
  'issues-timelines',
  'articles-timelines',
  'jobs',
  'logs',
  'images',
  'articles-suggestions',
  'uploaded-images',
  'mentions',
  'filepond',
  'embeddings',
  'table-of-contents',
  'search-queries-comparison',
  'me',
  'search-queries',
  'errors-collector',
  'ngram-trends',
  'topics-graph',
  'articles-text-reuse-passages',
  'text-reuse-cluster-passages',
  'filters-items',
  'stats',
  'articles-recommendations',
  'articles-search',
  'entities-suggestions',
  'entity-mentions-timeline',
  'subscriptions',
  'text-reuse-connected-clusters',
  'password-reset',
  'change-password',
  'terms-of-use',
  'user-change-plan-request',
  'user-requests',
  'user-requests-reviews',
  'newspapers',
]

export default (app: ImpressoApplication) => {
  const isPublicApi = app.get('isPublicApi')
  const features = app.get('features')
  const adminEndpointsEnabled = features?.adminEndpoints?.enabled

  const services = [
    ...publicApiServices,
    ...(!isPublicApi ? internalApiServices : []),
    ...(isPublicApi && adminEndpointsEnabled ? adminServices : []),
  ]

  logger.info(`Loading services: ${services.join(', ')}`)

  services.forEach((service: string) => {
    const path = `./${service}/${service}.service`
    const module = require(path)
    if (typeof module === 'function') app.configure(module)
    else app.configure(module.default)
  })
}
