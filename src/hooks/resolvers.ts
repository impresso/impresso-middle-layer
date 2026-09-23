import { keyBy } from 'lodash-es'
import { getLogger } from '@/logger.js'
import { HookContext } from '@feathersjs/feathers'
import { Service as SearchFacetService } from '@/services/search-facets/search-facets.class.js'
import { ImpressoApplication } from '@/types.js'
import { FindResponse } from '@/models/common.js'
import { SearchFacet, SearchFacetBucket, SearchFacetRangeBucket } from '@/models/generated/deprecated/models.js'
import { buildResolvers } from '@/internalServices/cachedResolvers.js'
import SpecialMembershipAccess from '@/models/special-membership-access.model.js'
const logger = getLogger(['impresso', 'hooks', 'resolvers'])

const supportedMethods = ['get', 'find']

const isSearchFacetBucket = (bucket: any): bucket is SearchFacetBucket => {
  return typeof bucket.value === 'string'
}

const isNonRangeSearchFacetBucket = (
  bucket: SearchFacetBucket | SearchFacetRangeBucket
): bucket is SearchFacetBucket => {
  return !('from' in bucket) && !('to' in bucket)
}

const resultAsList = (result: FindResponse<SearchFacet> | SearchFacet | undefined): SearchFacet[] => {
  if (result == null) return []

  if ('data' in result && Array.isArray(result.data)) {
    return result.data
  } else {
    return [result as SearchFacet]
  }
}

const assertCorrectServiceAndMethods = (
  hookName: string,
  context: HookContext<ImpressoApplication, SearchFacetService>
) => {
  if (!(context.service instanceof SearchFacetService))
    throw new Error(`${hookName} hook can only be used with ${SearchFacetService.name} service`)

  if (!supportedMethods.includes(context.method))
    throw new Error(`${hookName} hook can only be used with methods: ${supportedMethods}. Got: ${context.method}`)
}

export const resolveTextReuseClusters = () => async (context: HookContext<ImpressoApplication, SearchFacetService>) => {
  assertCorrectServiceAndMethods(resolveTextReuseClusters.name, context)

  const items = resultAsList(context.result)

  const ids = items
    .filter(d => d.type === 'textReuseCluster')
    .reduce((acc, d) => acc.concat(d.buckets.filter(isSearchFacetBucket).map(di => String(di.value))), [] as string[])

  if (!ids.length) return

  logger.debug(`resolveTextReuseClusters ids: ${ids}`)
  // get text reuse clusters as dictionary from text-reuse-clusters service
  const index = await context.app
    .service('text-reuse-passages')
    .find({
      query: {
        filters: [{ type: 'textReuseCluster', q: ids }],
        group_by: 'textReuseClusterId',
        // RK: x10 is a workaround for a Solr cluster that may return more items than IDs.
        // See https://impresso.slack.com/archives/CAHFF9TD1/p1756911197866689
        limit: ids.length * 10,
      },
    })
    .then(({ data }: { data: any }) => {
      logger.debug(`resolveTextReuseClusters data: ${data.length}`)
      return keyBy(data, 'textReuseCluster.id')
    })
    .catch((err: Error) => {
      logger.error('hook resolveTextReuseClusters ERROR')
      logger.error(err)
    })
  logger.debug(`resolveTextReuseClusters index keys: ${Object.keys(index)}`)

  items.forEach(d => {
    if (d.type !== 'textReuseCluster') return

    d.buckets.forEach(b => {
      if (isSearchFacetBucket(b)) {
        b.item = index[b.value]
      }
    })
  })
}

export const resolvePermissions = () => async (context: HookContext<ImpressoApplication, SearchFacetService>) => {
  const isPermissionFacet = (facet: SearchFacet): boolean =>
    ['permissionExplore', 'permissionGetTranscript', 'permissionGetImage'].includes(facet.type)
  const items: SearchFacet[] = resultAsList(context.result)

  const itemsIds = items
    .filter(isPermissionFacet)
    .reduce((acc, d) => {
      return acc.concat(d.buckets.filter(d => Number.isFinite(d.value)).map(di => String(di.value)))
    }, [] as string[])
    // remove dupes
    .reduce((acc, id) => (acc.includes(id) ? acc : acc.concat(id)), [] as string[])

  if (!itemsIds.length) return

  const resolvers = buildResolvers(context.app)

  const itemsById: Record<string, SpecialMembershipAccess> = {}
  for (const itemId of itemsIds) {
    const resolvedItem = await resolvers.specialMembershipAccess(itemId)
    if (resolvedItem) {
      itemsById[itemId] = resolvedItem
    }
  }

  items.forEach(d => {
    if (!isPermissionFacet(d)) return

    d.buckets.forEach(b => {
      if (isNonRangeSearchFacetBucket(b) && Number.isFinite(b.value) && itemsById[String(b.value)]) {
        b.item = itemsById[String(b.value)]
      }
    })
  })
  console.log('text', context.result)
}
