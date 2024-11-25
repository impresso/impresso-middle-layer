import lodash from 'lodash'
import Collection from '../models/collections.model'
import { HookContext } from '@feathersjs/feathers'
import { Service as SearchFacetService } from '../services/search-facets/search-facets.class'
import { ImpressoApplication } from '../types'
import { FindResponse } from '../models/common'
import { SearchFacet, SearchFacetBucket } from '../models/generated/schemas'
const debug = require('debug')('impresso/hooks/resolvers')

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
        limit: uids.length,
      },
    })
    .then(({ data }: { data: any }) => {
      debug('resolveTextReuseClusters data:', data.length)
      return lodash.keyBy(data, 'textReuseCluster.id')
    })
    .catch((err: Error) => {
      console.error('hook resolveTextReuseClusters ERROR')
      console.error(err)
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

export const resolveCollections = () => async (context: HookContext<ImpressoApplication, SearchFacetService>) => {
  assertCorrectServiceAndMethods(resolveTextReuseClusters.name, context)

  const items = resultAsList(context.result)

  const uids = items
    .filter(d => d.type === 'collection')
    .reduce((acc, d) => acc.concat(d.buckets.filter(isSearchFacetBucket).map(di => di.val)), [] as string[])

  if (!uids.length) return

  // get collections as dictionary
  const client = context.app.get('sequelizeClient')
  if (!client) {
    throw new Error('Sequelize client not available')
  }
  const index = (await Collection.sequelize(client)
    .findAll({
      where: {
        uid: uids,
      },
    })
    .then((rows: any[]) =>
      lodash.keyBy(
        rows.map(r => r.toJSON()),
        'uid'
      )
    )
    .catch((err: Error) => {
      console.error('hook resolveCollections ERROR')
      console.error(err)
      return {}
    })) as lodash.Dictionary<any>

  items.forEach(d => {
    if (d.type !== 'collection') return
    d.buckets.filter(isSearchFacetBucket).forEach(b => {
      b.item = index[b.val]
    })
  })
}
