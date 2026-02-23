import type { HookContext, NextFunction } from '@feathersjs/hooks'
import { logger } from '@/logger.js'
import type { ImpressoApplication } from '@/types.js'
import updateFacetRangesCache from '@/jobs/updateFacetRanges.js'
import updateMediaSourcesCache from '@/jobs/updateMediaSourcesCache.js'
import updateTopicsCache from '@/jobs/updateTopicsCache.js'
import updateYearsCache from '@/jobs/updateYears.js'
import { getQueueService } from '@/internalServices/queue.js'

/**
 * Jobs to run on startup
 */
export const startupJobs = async (context: HookContext<ImpressoApplication>, next: NextFunction) => {
  // run jobs asynchronously - no need to wait for them
  logger.info('Running async jobs...')
  const isPublicApi = context.app.get('isPublicApi') === true
  await Promise.all([
    updateMediaSourcesCache(context.app)
      .then(() => logger.info('Media sources cache updated.'))
      .catch(e => logger.error('Error updating media sources cache:', e)),
    updateTopicsCache(context.app)
      .then(() => logger.info('Topics cache updated.'))
      .catch(e => logger.error('Error updating topics cache:', e)),
    updateYearsCache(context.app)
      .then(() => logger.info('Years cache updated.'))
      .catch(e => logger.error('Error updating years cache:', e)),
    updateFacetRangesCache(context.app)
      .then(() => logger.info('Facet ranges cache updated.'))
      .catch(e => logger.error('Error updating facet ranges cache:', e)),
    ...(isPublicApi
      ? [
          getQueueService(context.app)
            .scheduleDownstreamServiceHealthCheck({ requestedBy: 'startup' })
            .then(() => logger.info('Periodic downstream health check scheduled (every 5 minutes).'))
            .catch(e => logger.error('Error scheduling periodic downstream health check:', e)),
        ]
      : [Promise.resolve(logger.info('Skipping downstream health check scheduling (internal API mode).'))]),
  ]).then(() => logger.info('Async jobs completed...'))

  await next()
}
