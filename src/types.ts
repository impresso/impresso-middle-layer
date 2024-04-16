import type { Application } from '@feathersjs/feathers'
import type { Configuration } from './configuration'
import type { IRateLimiter } from './services/internal/rateLimiter/redis'
import type { IRedisClientContainer } from './redis'

interface AppServices {
  redisClient?: IRedisClientContainer
  rateLimiter?: IRateLimiter
}

export type ImpressoApplication = Application<AppServices, Configuration>
