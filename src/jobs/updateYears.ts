import { prepareAvailableYearBuckets } from '@/useCases/prepareAvailableYearBuckets.js'
import { WellKnownKeys } from '@/cache.js'
import type { ImpressoApplication } from '@/types.js'
import { updateWellKnownEntry } from '@/internalServices/wellKnownCache.js'
import type { PreparedWellKnownEntry, UpdateWellKnownCacheOptions } from '@/internalServices/wellKnownCache.js'
import { getLogger } from '@/logger.js'

const logger = getLogger(['jobs', 'updateYears'])

export const prepareYearsCache = async (app: ImpressoApplication): Promise<PreparedWellKnownEntry> => {
  const years = await prepareAvailableYearBuckets(app.service('simpleSolrClient'))
  logger.info(`Prepared cache data for ${Object.keys(years).length} years`)
  return { key: WellKnownKeys.Years, data: JSON.stringify(years) }
}

const run = async (app: ImpressoApplication, options?: UpdateWellKnownCacheOptions): Promise<void> => {
  await updateWellKnownEntry(app.get('cacheManager'), WellKnownKeys.Years, () => prepareYearsCache(app), options)
}

export default run
