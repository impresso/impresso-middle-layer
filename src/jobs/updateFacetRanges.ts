import { getLogger } from '@/logger.js'
import { ImpressoApplication } from '@/types.js'
import { loadFacetRanges } from '@/useCases/loadFacetRanges.js'
import { writeFile, access, constants, stat } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const logger = getLogger(['jobs', 'updateFacetRanges'])

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const CacheFileName = resolve(__dirname, '../../data/facetRanges.json')

const cacheExists = async () => {
  try {
    await access(CacheFileName, constants.R_OK)
    const stats = await stat(CacheFileName)
    const oneHourAgo = Date.now() - 60 * 60 * 1000
    if (stats.mtimeMs < oneHourAgo) {
      return false
    }
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
const run = async (app: ImpressoApplication, reload: boolean = false) => {
  const solrClient = app.service('simpleSolrClient')

  // Check cache first
  const exists = await cacheExists()
  if (exists && !reload) {
    logger.info('Facet ranges data found in cache, skipping update.')
    return
  }

  logger.info('Updating facet ranges data...')
  try {
    const ranges = await loadFacetRanges(solrClient)
    await writeCache(ranges)
    logger.info('Successfully updated and cached facet ranges data.')
  } catch (error) {
    logger.error('Error updating facet ranges data:', { error })
    // Decide if the error should be re-thrown or handled
  }
}

export default run
