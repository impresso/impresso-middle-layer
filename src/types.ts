import type { Application } from '@feathersjs/feathers'
import type { Configuration } from './configuration'
import type { IRateLimiter } from './services/internal/rateLimiter/redis'
import type { IRedisClientContainer } from './redis'
import { Service as LogsService } from './services/logs/logs.class'
import { AuthenticationService } from '@feathersjs/authentication'
import { MediaSources } from './services/media-sources/media-sources.class'
import { NewspapersService } from './services/newspapers/newspapers.class'
import { SimpleSolrClient } from './internalServices/simpleSolr'
import { ContentItemService } from './services/content-items/content-items.class'

export interface AppServices {
  redisClient?: IRedisClientContainer
  rateLimiter?: IRateLimiter
  logs: LogsService
  authentication: AuthenticationService
  simpleSolrClient: SimpleSolrClient

  // Services
  ['media-sources']: MediaSources
  newspapers: NewspapersService
  ['content-items']: ContentItemService
}

export type ImpressoApplication = Application<AppServices & Record<string, any>, Configuration>
