import { Job } from 'bullmq'
import { logger } from '@/logger.js'
import { ImpressoApplication } from '@/types.js'
import { WellKnownKeys, WellKnownMetadataKeys } from '@/cache.js'
import updateMediaSourcesCache from '@/jobs/updateMediaSourcesCache.js'
import updateTopicsCache from '@/jobs/updateTopicsCache.js'
import updateYearsCache from '@/jobs/updateYears.js'

export const JobNameRebuildWellKnownCache = 'rebuildWellKnownCache'

export interface RebuildWellKnownCacheJobData {
  requestedBy?: string
}

type RebuildWellKnownCacheJob = Job<RebuildWellKnownCacheJobData, undefined, typeof JobNameRebuildWellKnownCache>

const wellKnownKeys = [
  WellKnownKeys.MediaSources,
  WellKnownKeys.Topics,
  WellKnownKeys.Years,
  WellKnownMetadataKeys.MediaSourcesComputedAt,
  WellKnownMetadataKeys.TopicsComputedAt,
  WellKnownMetadataKeys.YearsComputedAt,
]

const clearWellKnownCache = async (app: ImpressoApplication) => {
  const cache = app.get('cacheManager')
  await Promise.all(wellKnownKeys.map(key => cache.del(key)))
}

export const createJobHandler = (app: ImpressoApplication) => {
  return async (job: RebuildWellKnownCacheJob) => {
    logger.info(
      `➡️ 🧹 Processing job ${job.id} ${job.name} to rebuild well-known caches (requestedBy: ${job.data.requestedBy ?? 'unknown'})`
    )
    await clearWellKnownCache(app)
    await updateMediaSourcesCache(app)
    await updateYearsCache(app)
    await updateTopicsCache(app)
    logger.info(`➡️ 🧹 Finished job ${job.id} ${job.name} to rebuild well-known caches`)
    return undefined
  }
}
