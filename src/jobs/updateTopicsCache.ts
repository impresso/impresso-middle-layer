import { prepareTopics } from '@/useCases/prepareTopics.js'
import { WellKnownKeys } from '@/cache.js'
import type { ImpressoApplication } from '@/types.js'
import { updateWellKnownEntry } from '@/internalServices/wellKnownCache.js'
import type { PreparedWellKnownEntry, UpdateWellKnownCacheOptions } from '@/internalServices/wellKnownCache.js'

export const prepareTopicsCache = async (app: ImpressoApplication): Promise<PreparedWellKnownEntry> => {
  const topics = await prepareTopics(app.service('simpleSolrClient'))
  return { key: WellKnownKeys.Topics, data: JSON.stringify(topics) }
}

const run = async (app: ImpressoApplication, options?: UpdateWellKnownCacheOptions): Promise<void> => {
  await updateWellKnownEntry(app.get('cacheManager'), WellKnownKeys.Topics, () => prepareTopicsCache(app), options)
}

export default run
