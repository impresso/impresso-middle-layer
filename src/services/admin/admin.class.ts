import { WellKnownMetadataKeys } from '@/cache.js'
import { getQueueService } from '@/internalServices/queue.js'
import type { Admin, AdminPatchRequest } from '@/models/generated/schemasPublic.js'
import type { RedisClient } from '@/redis.js'
import { WikidataCacheKeyPrefix } from '@/services/wikidata.js'
import { ImpressoApplication } from '@/types.js'
import { getContentItemsPermissionsDetails } from '@/useCases/getContentItemsPermissionsDetails.js'
import { Params } from '@feathersjs/feathers'

type FindResponse = Admin & {
  contentItemsPermissionsDetails: Awaited<ReturnType<typeof getContentItemsPermissionsDetails>>
  imagesPermissionsDetails: Awaited<ReturnType<typeof getContentItemsPermissionsDetails>>
  cacheCounts: CacheCounts
  wellKnownComputedAt: WellKnownComputedAt
}
interface FindParams {}

type CacheAction = AdminPatchRequest['action']
type CacheCounts = NonNullable<Admin['cacheCounts']>
type WellKnownComputedAt = NonNullable<Admin['wellKnownComputedAt']>
type PatchData = AdminPatchRequest
type PatchResponse = NonNullable<Admin['patchResult']> & { action: CacheAction }

interface IService {
  find(params?: Params<FindParams>): Promise<FindResponse>
  patch(id: null, data: PatchData, params?: Params): Promise<PatchResponse>
}

const DbCacheKeyPattern = 'cache:db:*'
const SolrCacheKeyPattern = 'cache:solr:*'
const WikidataCacheKeyPattern = `${WikidataCacheKeyPrefix}*`

export class Service implements IService {
  constructor(private readonly app: ImpressoApplication) {}

  async find(params?: Params<FindParams>): Promise<FindResponse> {
    const [contentItemsPermissionsDetails, imagesPermissionsDetails, cacheCounts, wellKnownComputedAt] =
      await Promise.all([
        getContentItemsPermissionsDetails(this.app.service('simpleSolrClient'), 'Search'),
        getContentItemsPermissionsDetails(this.app.service('simpleSolrClient'), 'Images'),
        this.getCacheCounts(),
        this.getWellKnownComputedAt(),
      ])

    return {
      contentItemsPermissionsDetails: contentItemsPermissionsDetails as FindResponse['contentItemsPermissionsDetails'],
      imagesPermissionsDetails: imagesPermissionsDetails as FindResponse['imagesPermissionsDetails'],
      cacheCounts: cacheCounts,
      wellKnownComputedAt: wellKnownComputedAt,
    }
  }

  async patch(_id: null, data: PatchData, params?: Params): Promise<PatchResponse> {
    const redisClient = this.getRedisClient()
    switch (data.action) {
      case 'clear-db-cache': {
        const count = await this.deleteKeysByPattern(redisClient, DbCacheKeyPattern)
        return { action: data.action, cleared: { count } }
      }
      case 'clear-solr-cache': {
        const count = await this.deleteKeysByPattern(redisClient, SolrCacheKeyPattern)
        return { action: data.action, cleared: { count } }
      }
      case 'clear-wikidata-cache': {
        const count = await this.deleteKeysByPattern(redisClient, WikidataCacheKeyPattern)
        return { action: data.action, cleared: { count } }
      }
      case 'rebuild-well-known-cache': {
        const queueService = getQueueService(this.app)
        const job = await queueService.rebuildWellKnownCache({
          requestedBy: (params as any)?.user?.uid,
        })
        return { action: data.action, jobId: String(job.id) }
      }
      default: {
        return { action: data.action }
      }
    }
  }

  private getRedisClient(): RedisClient {
    const redisClient = this.app.service('redisClient')?.client as RedisClient | undefined
    if (!redisClient) {
      throw new Error('Redis client not available')
    }
    return redisClient
  }

  private async getCacheCounts(): Promise<CacheCounts> {
    const redisClient = this.getRedisClient()
    const [db, solr, wikidata] = await Promise.all([
      this.countKeysByPattern(redisClient, DbCacheKeyPattern),
      this.countKeysByPattern(redisClient, SolrCacheKeyPattern),
      this.countKeysByPattern(redisClient, WikidataCacheKeyPattern),
    ])
    return { db, solr, wikidata }
  }

  private async getWellKnownComputedAt(): Promise<WellKnownComputedAt> {
    const cache = this.app.get('cacheManager')
    const [mediaSources, topics, years] = await Promise.all([
      cache.get<string>(WellKnownMetadataKeys.MediaSourcesComputedAt),
      cache.get<string>(WellKnownMetadataKeys.TopicsComputedAt),
      cache.get<string>(WellKnownMetadataKeys.YearsComputedAt),
    ])
    return {
      mediaSources: mediaSources ?? null,
      topics: topics ?? null,
      years: years ?? null,
    }
  }

  private async countKeysByPattern(redisClient: RedisClient, pattern: string): Promise<number> {
    let cursor = '0'
    let count = 0
    do {
      const result = await redisClient.scan(cursor, { MATCH: pattern, COUNT: 1000 })
      cursor = result.cursor
      count += result.keys.length
    } while (cursor !== '0')
    return count
  }

  private async deleteKeysByPattern(redisClient: RedisClient, pattern: string): Promise<number> {
    let cursor = '0'
    let deleted = 0
    do {
      const result = await redisClient.scan(cursor, { MATCH: pattern, COUNT: 1000 })
      cursor = result.cursor
      if (result.keys.length) {
        const removed = await redisClient.del(result.keys)
        deleted += removed
      }
    } while (cursor !== '0')
    return deleted
  }
}
