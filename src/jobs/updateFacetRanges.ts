import { ImpressoApplication } from '../types'
import { loadFacetRanges } from '../useCases/loadFacetRanges'
import { writeFile, access, constants } from 'node:fs/promises'

const CacheFileName = './data/facetRanges.json'

const cacheExists = async () => {
  try {
    await access(CacheFileName, constants.R_OK)
    return true
  } catch {
    return false
  }
}

const writeCache = async (data: any) => {
  await writeFile(CacheFileName, JSON.stringify(data), { encoding: 'utf8' })
}
/**
 * Prepare facet ranges and store them in cache.
 *
 * NOTE: Using file as a cache because static code in
 * IML depends on it. Cache can be moved to Redis later
 * when the static code is refactored.
 */
const run = async (app: ImpressoApplication) => {
  const cache = app.get('cacheManager')
  const solrClient = app.service('simpleSolrClient')

  // Check cache first
  const exists = await cacheExists()
  if (exists) {
    console.log('Facet ranges data found in cache, skipping update.')
    return
  }

  console.log('Updating facet ranges data...')
  try {
    const ranges = await loadFacetRanges(solrClient)
    await writeCache(ranges)
    console.log(`Successfully updated and cached facet ranges data.`)
  } catch (error) {
    console.error('Error updating facet ranges data:', error)
    // Decide if the error should be re-thrown or handled
  }
}

export default run
