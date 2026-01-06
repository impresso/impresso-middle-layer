import type { Configuration } from '@/configuration.js'
import { QueueService } from '@/internalServices/queue.js'
import { SimpleSolrClient } from '@/internalServices/simpleSolr.js'
import type { IRedisClientContainer } from '@/redis.js'
import { ICollectableItemsService } from '@/services/collectable-items/collectable-items.class.js'
import { ICollectionsService } from '@/services/collections/collections.class.js'
import { ContentItemService } from '@/services/content-items/content-items.class.js'
import type { IRateLimiter } from '@/services/internal/rateLimiter/redis.js'
import { Service as LogsService } from '@/services/logs/logs.class.js'
import { MediaSources } from '@/services/media-sources/media-sources.class.js'
import { NewspapersService } from '@/services/newspapers/newspapers.class.js'
import { AuthenticationService } from '@feathersjs/authentication'
import type { Application } from '@feathersjs/feathers'

export interface AppServices {
  redisClient?: IRedisClientContainer
  rateLimiter?: IRateLimiter
  logs: LogsService
  authentication: AuthenticationService
  simpleSolrClient: SimpleSolrClient
  queueService: QueueService

  // Services
  ['media-sources']: MediaSources
  newspapers: NewspapersService
  ['content-items']: ContentItemService
  collections: ICollectionsService
  ['collectable-items']: ICollectableItemsService
}

export type ImpressoApplication = Application<AppServices & Record<string, any>, Configuration>
