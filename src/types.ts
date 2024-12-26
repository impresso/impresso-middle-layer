import type { Application } from '@feathersjs/feathers'
import type { Configuration } from './configuration'
import type { IRateLimiter } from './services/internal/rateLimiter/redis'
import type { IRedisClientContainer } from './redis'
import { CachedSolrClient } from './cachedSolr'
import { Service as LogsService } from './services/logs/logs.class'
import { AuthenticationService } from '@feathersjs/authentication'
import { MediaSources } from './services/media-sources/media-sources.class'
import { NewspapersService } from './services/newspapers/newspapers.class'

export interface AppServices {
  redisClient?: IRedisClientContainer
  rateLimiter?: IRateLimiter
  cachedSolr: CachedSolrClient
  logs: LogsService
  authentication: AuthenticationService

  // Services
  ['media-sources']: MediaSources
  newspapers: NewspapersService
}

export type ImpressoApplication = Application<AppServices & Record<string, any>, Configuration>
