import { ImpressoApplication } from '@/types.js'
import { logger } from '@/logger.js'
import type { Application as ExpressApplication } from '@feathersjs/express'

// services
import search from './search/search.service.js'
import contentItems from './content-items/content-items.service.js'
import users from './users/users.service.js'
import admin from './admin/admin.service.js'
import issues from './issues/issues.service.js'
import logs from './logs/logs.service.js'
import collectableItems from './collectable-items/collectable-items.service.js'
import collections from './collections/collections.service.js'
import textReusePassages from './text-reuse-passages/text-reuse-passages.service.js'
import textReuseClusters from './text-reuse-clusters/text-reuse-clusters.service.js'
import version from './version/version.service.js'
import searchFacets from './search-facets/search-facets.service.js'
import entities from './entities/entities.service.js'
import impressoNer from './impresso-ner/impresso-ner.service.js'
import impressoEmbedder from './impresso-embedder/impresso-embedder.service.js'
import mediaSources from './media-sources/media-sources.service.js'
import dataProviders from './data-providers/data-providers.service.js'
import topics from './topics/topics.service.js'
import images from './images/images.service.js'
import experiments from './experiments/experiments.service.js'
import suggestions from './suggestions/suggestions.service.js'
import pages from './pages/pages.service.js'
import searchExporter from './search-exporter/search-exporter.service.js'
import init from './init/init.service.js'
import pagesTimelines from './pages-timelines/pages-timelines.service.js'
import issuesTimelines from './issues-timelines/issues-timelines.service.js'
import articlesTimelines from './articles-timelines/articles-timelines.service.js'
import jobs from './jobs/jobs.service.js'
import articlesSuggestions from './articles-suggestions/articles-suggestions.service.js'
import uploadedImages from './uploaded-images/uploaded-images.service.js'
import mentions from './mentions/mentions.service.js'
import filepond from './filepond/filepond.service.js'
import embeddings from './embeddings/embeddings.service.js'
import tableOfContents from './table-of-contents/table-of-contents.service.js'
import searchQueriesComparison from './search-queries-comparison/search-queries-comparison.service.js'
import me from './me/me.service.js'
import searchQueries from './search-queries/search-queries.service.js'
import errorsCollector from './errors-collector/errors-collector.service.js'
import ngramTrends from './ngram-trends/ngram-trends.service.js'
import topicsGraph from './topics-graph/topics-graph.service.js'
import articlesTextReusePassages from './articles-text-reuse-passages/articles-text-reuse-passages.service.js'
import textReuseClusterPassages from './text-reuse-cluster-passages/text-reuse-cluster-passages.service.js'
import filtersItems from './filters-items/filters-items.service.js'
import stats from './stats/stats.service.js'
import articlesRecommendations from './articles-recommendations/articles-recommendations.service.js'
import articlesSearch from './articles-search/articles-search.service.js'
import entitiesSuggestions from './entities-suggestions/entities-suggestions.service.js'
import entityMentionsTimeline from './entity-mentions-timeline/entity-mentions-timeline.service.js'
import subscriptions from './subscriptions/subscriptions.service.js'
import textReuseConnectedClusters from './text-reuse-connected-clusters/text-reuse-connected-clusters.service.js'
import passwordReset from './password-reset/password-reset.service.js'
import changePassword from './change-password/change-password.service.js'
import termsOfUse from './terms-of-use/terms-of-use.service.js'
import userChangePlanRequest from './user-change-plan-request/user-change-plan-request.service.js'
import userRequests from './user-requests/user-requests.service.js'
import userRequestsReviews from './user-special-membership-requests-reviews/user-special-membership-requests-reviews.service.js'
import newspapers from './newspapers/newspapers.service.js'
import feedbackCollector from './feedback-collector/feedback-collector.service.js'
import datalabSupport from './datalab-support/datalab-support.service.js'
import specialMembershipAccess from './special-membership-access/special-membership-access.service.js'
import userSpecialMembershipRequests from './user-special-membership-requests/user-special-membership-requests.service.js'
import userSpecialMembershipRequestsReviews from './user-special-membership-requests-reviews/user-special-membership-requests-reviews.service.js'
import baristaProxy from './barista-proxy/barista-proxy.service.js'

/**
 * Some public services are declared here but are only required internally by
 * other services. Whether a service is available publicly or not is determined
 * in the service files. Look for the `optionsDisabledInPublicApi` method.
 */
const publicApiServices = [
  { name: 'search', init: search },
  { name: 'content-items', init: contentItems },
  { name: 'users', init: users },
  { name: 'collectable-items', init: collectableItems },
  { name: 'collections', init: collections },
  { name: 'text-reuse-passages', init: textReusePassages },
  { name: 'text-reuse-clusters', init: textReuseClusters },
  { name: 'version', init: version },
  { name: 'search-facets', init: searchFacets },
  { name: 'entities', init: entities },
  { name: 'impresso-ner', init: impressoNer },
  { name: 'impresso-embedder', init: impressoEmbedder },
  { name: 'media-sources', init: mediaSources },
  { name: 'data-providers', init: dataProviders },
  { name: 'topics', init: topics },
  { name: 'images', init: images },
  { name: 'experiments', init: experiments },
  { name: 'logs', init: logs },
]

const adminServices = [{ name: 'admin', init: admin }]

const internalApiServices = [
  { name: 'issues', init: issues },
  { name: 'suggestions', init: suggestions },
  { name: 'pages', init: pages },
  { name: 'search-exporter', init: searchExporter },
  { name: 'init', init: init },
  { name: 'pages-timelines', init: pagesTimelines },
  { name: 'issues-timelines', init: issuesTimelines },
  { name: 'articles-timelines', init: articlesTimelines },
  { name: 'jobs', init: jobs },
  { name: 'articles-suggestions', init: articlesSuggestions },
  { name: 'uploaded-images', init: uploadedImages },
  { name: 'mentions', init: mentions },
  { name: 'filepond', init: filepond },
  { name: 'embeddings', init: embeddings },
  { name: 'table-of-contents', init: tableOfContents },
  { name: 'search-queries-comparison', init: searchQueriesComparison },
  { name: 'me', init: me },
  { name: 'search-queries', init: searchQueries },
  { name: 'errors-collector', init: errorsCollector },
  { name: 'ngram-trends', init: ngramTrends },
  { name: 'topics-graph', init: topicsGraph },
  { name: 'articles-text-reuse-passages', init: articlesTextReusePassages },
  { name: 'text-reuse-cluster-passages', init: textReuseClusterPassages },
  { name: 'filters-items', init: filtersItems },
  { name: 'stats', init: stats },
  { name: 'articles-recommendations', init: articlesRecommendations },
  { name: 'articles-search', init: articlesSearch },
  { name: 'entities-suggestions', init: entitiesSuggestions },
  { name: 'entity-mentions-timeline', init: entityMentionsTimeline },
  { name: 'subscriptions', init: subscriptions },
  { name: 'text-reuse-connected-clusters', init: textReuseConnectedClusters },
  { name: 'password-reset', init: passwordReset },
  { name: 'change-password', init: changePassword },
  { name: 'terms-of-use', init: termsOfUse },
  { name: 'user-change-plan-request', init: userChangePlanRequest },
  { name: 'user-requests', init: userRequests },
  { name: 'newspapers', init: newspapers },
  { name: 'feedback-collector', init: feedbackCollector },
  { name: 'datalab-support', init: datalabSupport },
  { name: 'special-membership-access', init: specialMembershipAccess },
  { name: 'user-special-membership-requests', init: userSpecialMembershipRequests },
  { name: 'user-special-membership-requests-reviews', init: userSpecialMembershipRequestsReviews },
]

const baristaServices = [{ name: 'barista-proxy', init: baristaProxy }]

export default (app: ImpressoApplication & ExpressApplication) => {
  const isPublicApi = app.get('isPublicApi')
  const features = app.get('features')
  const adminEndpointsEnabled = features?.adminEndpoints?.enabled

  const services = [
    ...publicApiServices,
    ...(!isPublicApi ? internalApiServices : []),
    ...(isPublicApi && adminEndpointsEnabled ? adminServices : []),
    ...(!isPublicApi && features?.barista?.enabled ? baristaServices : []),
  ]

  const serviceNames = services.map(s => s.name)
  logger.info(`Loading services: ${serviceNames.join(', ')}`)

  services.forEach(service => {
    app.configure(service.init)
  })
}
