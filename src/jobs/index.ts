import type { HookContext, NextFunction } from '@feathersjs/hooks'
import type { ImpressoApplication } from '../types'
import updateMediaSourcesCache from './updateMediaSourcesCache'
import { logger } from '../logger'

/**
 * Jobs to run on startup
 */
export const startupJobs = async (context: HookContext<ImpressoApplication>, next: NextFunction) => {
  // run jobs asynchronously - no need to wait for them
  logger.info('Updating media sources cache...')
  updateMediaSourcesCache(context.app)
    .then(() => logger.info('Media sources cache updated.'))
    .catch(e => logger.error('Error updating media sources cache:', e))

  await next()
}
