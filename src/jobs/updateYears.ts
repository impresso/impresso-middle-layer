import { WellKnownKeys, WellKnownMetadataKeys } from '@/cache.js'
import { getLogger } from '@/logger.js'
import { ImpressoApplication } from '@/types.js'
import { prepareAvailableYearBuckets } from '@/useCases/prepareAvailableYearBuckets.js' // Import the use case

const logger = getLogger(['jobs', 'updateYears'])

/** 100 days */
const DefaultTtlMilliSeconds = 60 * 60 * 24 * 100 * 1000

/**
 * Prepare year statistics and store them in cache.
 */
const run = async (app: ImpressoApplication) => {
  const cache = app.get('cacheManager')
  const solrClient = app.service('simpleSolrClient')

  // Check cache first
  const cached = await cache.get(WellKnownKeys.Years)
  if (cached != null) {
    logger.info('Years data found in cache, skipping update.')
    return
  }

  logger.info('Updating years data...')
  try {
    // Use the imported function from the use case
    const years = await prepareAvailableYearBuckets(solrClient)

    await cache.set(WellKnownKeys.Years, JSON.stringify(years), DefaultTtlMilliSeconds)
    await cache.set(WellKnownMetadataKeys.YearsComputedAt, new Date().toISOString(), DefaultTtlMilliSeconds)
    logger.info(`Successfully updated and cached years data for ${Object.keys(years).length} years.`)
  } catch (error) {
    logger.error('Error updating years data:', { error })
    // Decide if the error should be re-thrown or handled
  }
}

export default run
