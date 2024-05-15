import type { Application } from '@feathersjs/feathers'
import type { Configuration } from './configuration'
import type { IRateLimiter } from './services/internal/rateLimiter/redis'
import type { IRedisClientContainer } from './redis'
import { CachedSolrClient } from './cachedSolr'
import { Service as LogsService } from './services/logs/logs.class'
import { AuthenticationService } from '@feathersjs/authentication'

interface AppServices {
  redisClient?: IRedisClientContainer
  rateLimiter?: IRateLimiter
  cachedSolr: CachedSolrClient
  logs: LogsService
  authentication: AuthenticationService
}

export type ImpressoApplication = Application<AppServices, Configuration>
