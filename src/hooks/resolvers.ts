import lodash from 'lodash'
import { logger } from '@/logger.js'
import { HookContext } from '@feathersjs/feathers'
import { Service as SearchFacetService } from '@/services/search-facets/search-facets.class.js'
import { ImpressoApplication } from '@/types.js'
import { FindResponse } from '@/models/common.js'
import { SearchFacet, SearchFacetBucket } from '@/models/generated/schemas.js'
import debugLib from 'debug'
const debug = debugLib('impresso/hooks/resolvers')

const supportedMethods = ['get', 'find']

const isSearchFacetBucket = (bucket: any): bucket is SearchFacetBucket => {
  return typeof bucket.val === 'string'
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

  const uids = items
    .filter(d => d.type === 'textReuseCluster')
    .reduce((acc, d) => acc.concat(d.buckets.filter(isSearchFacetBucket).map(di => di.val)), [] as string[])

  if (!uids.length) return

  debug('resolveTextReuseClusters uids:', uids)
  // get text reuse clusters as dictionary from text-reuse-clusters service
  const index = await context.app
    .service('text-reuse-passages')
    .find({
      query: {
        filters: [{ type: 'textReuseCluster', q: uids }],
        group_by: 'textReuseClusterId',
        // RK: x10 is a workaround for a Solr cluster that may return more items than IDs.
        // See https://impresso.slack.com/archives/CAHFF9TD1/p1756911197866689
        limit: uids.length * 10,
      },
    })
    .then(({ data }: { data: any }) => {
      debug('resolveTextReuseClusters data:', data.length)
      return lodash.keyBy(data, 'textReuseCluster.id')
    })
    .catch((err: Error) => {
      logger.error('hook resolveTextReuseClusters ERROR')
      logger.error(err)
    })
  debug('resolveTextReuseClusters index keys:', Object.keys(index))

  items.forEach(d => {
    if (d.type !== 'textReuseCluster') return

    d.buckets.forEach(b => {
      if (isSearchFacetBucket(b)) {
        b.item = index[b.val]
      }
    })
  })
}
