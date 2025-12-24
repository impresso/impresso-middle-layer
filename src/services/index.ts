import { ImpressoApplication } from '@/types.js'
import { logger } from '@/logger.js'
// services
import search from './search/search.service.js'
import contentItems from './content-items/content-items.service.js'
import users from './users/users.service.js'
import admin from './admin/admin.service.js'
import issues from './issues/issues.service.js'
import logs from './logs/logs.service.js'

import baristaProxy from './barista-proxy/barista-proxy.service.js'

/**
 * Some public services are declared here but are only required internally by
 * other services. Whether a service is available publicly or not is determined
 * in the service files. Look for the `optionsDisabledInPublicApi` method.
 */
const publicApiServices = [
  search, // search items
  contentItems, // get content items
  users, // required for authentication
  // 'collectable-items',
  // 'collections', // CRUD collections
  // 'text-reuse-passages',
  // 'text-reuse-clusters',
  // 'version',
  // 'search-facets',
  // 'entities',
  // 'impresso-ner',
  // 'impresso-embedder',
  // 'media-sources',
  // 'data-providers',
  // 'topics',
  // 'images',
  // 'experiments',
  // 'logs', // used internally
]

const adminServices = [
  // 'admin'
  admin,
]

const internalApiServices = [
  issues,
  logs,
  // 'issues',
  // 'suggestions',
  // 'pages',
  // 'search-exporter',
  // 'init',
  // 'pages-timelines',
  // 'issues-timelines',
  // 'articles-timelines',
  // 'jobs',
  // 'articles-suggestions',
  // 'uploaded-images',
  // 'mentions',
  // 'filepond',
  // 'embeddings',
  // 'table-of-contents',
  // 'search-queries-comparison',
  // 'me',
  // 'search-queries',
  // 'errors-collector',
  // 'ngram-trends',
  // 'topics-graph',
  // 'articles-text-reuse-passages',
  // 'text-reuse-cluster-passages',
  // 'filters-items',
  // 'stats',
  // 'articles-recommendations',
  // 'articles-search',
  // 'entities-suggestions',
  // 'entity-mentions-timeline',
  // 'subscriptions',
  // 'text-reuse-connected-clusters',
  // 'password-reset',
  // 'change-password',
  // 'terms-of-use',
  // 'user-change-plan-request',
  // 'user-requests',
  // 'user-requests-reviews',
  // 'newspapers',
  // 'feedback-collector',
  // 'datalab-support',
  // 'special-membership-access',
  // 'user-special-membership-requests',
]

const baristaServices = [
  // 'barista-proxy'
  baristaProxy,
]

export default (app: ImpressoApplication) => {
  const isPublicApi = app.get('isPublicApi')
  const features = app.get('features')
  const adminEndpointsEnabled = features?.adminEndpoints?.enabled

  const services = [
    ...publicApiServices,
    ...(!isPublicApi ? internalApiServices : []),
    ...(isPublicApi && adminEndpointsEnabled ? adminServices : []),
    ...(!isPublicApi && features?.barista?.enabled ? baristaServices : []),
  ]

  logger.info(`Loading services: ${services.map(s => s.name).join(', ')}`)

  services.forEach(service => {
    app.configure(service)
    // const path = `./${service}/${service}.service`
    // try {
    //   const module = import(path)
    //   if (typeof module === 'function') app.configure(module)
    //   else app.configure(module.default)
    // } catch (err) {
    //   console.error(`Error loading service ${service} from path ${path}: ${err}`)
    //   throw err
    // }
  })
}
