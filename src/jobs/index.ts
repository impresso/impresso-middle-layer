import type { HookContext, NextFunction } from '@feathersjs/hooks'
import type { ImpressoApplication } from '../types'
import updateMediaSourcesCache from './updateMediaSourcesCache'
import updateTopicsCache from './updateTopicsCache'
import updateYearsCache from './updateYears'
import { logger } from '../logger'

/**
 * Jobs to run on startup
 */
export const startupJobs = async (context: HookContext<ImpressoApplication>, next: NextFunction) => {
  // run jobs asynchronously - no need to wait for them
  logger.info('Running async jobs...')
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
  ])
  logger.info('Async jobs completed...')

  await next()
}
