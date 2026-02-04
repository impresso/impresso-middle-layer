import { Indexes, SolrMappings } from '@/data/constants.js'
import { SolrRangeFacetQueryParams } from '@/data/types.js'
import { SimpleSolrClient } from '@/internalServices/simpleSolr.js'
import { logger } from '@/logger.js'
import { SolrNamespace } from '@/solr.js'

// Define the structure for the processed facet ranges
export interface FacetRangeInfo {
  min: number | string | Date | null
  max: number | string | Date | null
}

export type AllFacetRanges = Record<string, Record<string, FacetRangeInfo>>

/**
 * Fetches the minimum and maximum values for all configured range facets
 * across specified Solr indexes.
 *
 * @param solrClient - The SimpleSolrClient instance.
 * @returns A promise that resolves to an object containing the facet ranges for each index.
 */
export const loadFacetRanges = async (solrClient: SimpleSolrClient): Promise<AllFacetRanges> => {
  const allRanges: AllFacetRanges = {}

  // Iterate over each configured Solr index (namespace)
  for (const index of Indexes) {
    const indexConfig = SolrMappings[index]

    // Identify range facets for the current index
    const rangeFacets = Object.entries(indexConfig.facets || {}).filter(
      ([_, facet]) => typeof facet !== 'string' && facet.type === 'range'
    ) as [string, SolrRangeFacetQueryParams][]

    if (rangeFacets.length === 0) {
      logger.info(`No range facets configured for index: ${index}. Skipping.`)
      allRanges[index] = {}
      continue
    }

    // Construct the facet part of the Solr query dynamically
    const facetQueryPart = rangeFacets.reduce(
      (acc, [facetKey, descriptor]) => {
        acc[`${facetKey}__min`] = `min(${descriptor.field})`
        acc[`${facetKey}__max`] = `max(${descriptor.field})`
        return acc
      },
      {} as Record<string, string>
    )

    try {
      // Execute the Solr query using the select method with stats component
      const response = await solrClient.select<unknown, string, never>(index as SolrNamespace, {
        body: {
          query: '*:*',
          limit: 0,
          facet: facetQueryPart,
        },
      })

      // Process the response to extract min/max values
      const facetsResponse = response.facets
      const indexRanges: Record<string, FacetRangeInfo> = {}

      if (facetsResponse) {
        // Group min/max values by facet key
        Object.entries(facetsResponse).forEach(([key, value]) => {
          if (key === 'count') return // Skip the overall count

          const [facetKey, statType] = key.split('__') // e.g., "year__min" -> ["year", "min"]

          if (!indexRanges[facetKey]) {
            indexRanges[facetKey] = { min: null, max: null }
          }

          if (statType === 'min') {
            indexRanges[facetKey].min = value as any as number
          } else if (statType === 'max') {
            indexRanges[facetKey].max = value as any as number
          }
        })
      } else {
        logger.warn(`No facet data returned for index: ${index}`)
      }

      allRanges[index] = indexRanges
      logger.info(`Successfully loaded facet ranges for index: ${index}`)
    } catch (error: any) {
      logger.error(`Error fetching facet ranges for index ${index}: ${error instanceof Error ? error.message : error}`)
      // Decide if we should throw, return partial data, or an empty object for this index
      allRanges[index] = {} // Assign empty object on error for this index
    }
  }

  return allRanges
}
