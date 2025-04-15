import { WellKnownKeys } from '../cache'
import { ImpressoApplication } from '../types'
import { prepareAvailableYearBuckets } from '../useCases/prepareAvailableYearBuckets' // Import the use case

/** 100 days */
const DefaultTtlSeconds = 60 * 60 * 24 * 100 * 1000

/**
 * Prepare year statistics and store them in cache.
 */
const run = async (app: ImpressoApplication) => {
  const cache = app.get('cacheManager')
  const solrClient = app.service('simpleSolrClient')

  // Check cache first
  const cached = await cache.get(WellKnownKeys.Years)
  if (cached != null) {
    console.log('Years data found in cache, skipping update.')
    return
  }

  console.log('Updating years data...')
  try {
    // Use the imported function from the use case
    const years = await prepareAvailableYearBuckets(solrClient)

    await cache.set(WellKnownKeys.Years, JSON.stringify(years), DefaultTtlSeconds)
    console.log(`Successfully updated and cached years data for ${Object.keys(years).length} years.`)
  } catch (error) {
    console.error('Error updating years data:', error)
    // Decide if the error should be re-thrown or handled
  }
}

export default run
