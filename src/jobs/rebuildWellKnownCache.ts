import { Job } from 'bullmq'
import { logger } from '@/logger.js'
import { ImpressoApplication } from '@/types.js'
import { rebuildWellKnownEntries } from '@/internalServices/wellKnownCache.js'
import { prepareMediaSourcesCache } from '@/jobs/updateMediaSourcesCache.js'
import { prepareSpecialMembershipAccessCache } from '@/jobs/updateSpecialMembershipAccessCache.js'
import { prepareTopicsCache } from '@/jobs/updateTopicsCache.js'
import { prepareYearsCache } from '@/jobs/updateYears.js'

export const JobNameRebuildWellKnownCache = 'rebuildWellKnownCache'

export interface RebuildWellKnownCacheJobData {
  requestedBy?: string
}

type RebuildWellKnownCacheJob = Job<RebuildWellKnownCacheJobData, undefined, typeof JobNameRebuildWellKnownCache>

/** Prepare every dataset before publishing any replacement. Each dataset commits with one SET. */
export const rebuildWellKnownCache = async (app: ImpressoApplication): Promise<void> => {
  await rebuildWellKnownEntries(app.get('cacheManager'), [
    () => prepareMediaSourcesCache(app),
    () => prepareYearsCache(app),
    () => prepareTopicsCache(app),
    () => prepareSpecialMembershipAccessCache(app),
  ])
}

export const createJobHandler = (app: ImpressoApplication) => {
  return async (job: RebuildWellKnownCacheJob) => {
    logger.info(
      `➡️ 🧹 Processing job ${job.id} ${job.name} to rebuild well-known caches (requestedBy: ${job.data.requestedBy ?? 'unknown'})`
    )
    await rebuildWellKnownCache(app)
    logger.info(`➡️ 🧹 Finished job ${job.id} ${job.name} to rebuild well-known caches`)
    return undefined
  }
}
