import KeyvRedis from '@keyv/redis'
import { createCache } from 'cache-manager'
import { Keyv } from 'keyv'
import type { Configuration } from './configuration'
import { logger } from './logger'
import type { ImpressoApplication } from './types'

export type { Cache } from 'cache-manager'

const buildRedisUri = (config: Configuration['redis']): string => {
  const host = config?.host ?? 'localhost'
  const port = config?.port ?? 6379

  return `redis://${host}:${port}`
}

export default (app: ImpressoApplication) => {
  const config = app.get('redis')
  const cacheConfig = app.get('cache')
  const isEnabled = cacheConfig?.enabled

  const redisStore = isEnabled
    ? new Keyv({
        store: new KeyvRedis(buildRedisUri(config), {}),
        useKeyPrefix: false,
        namespace: undefined,
      })
    : undefined

  redisStore?.on('error', err => {
    logger.error('Redis store error: ', err)
  })
  //
  const cache = createCache({
    stores: redisStore != null ? [redisStore] : [],
  })

  app.set('cacheManager', cache)
}

export const WellKnownKeys = Object.freeze({
  MediaSources: 'cache:mediaSources',
  Topics: 'cache:topics',
})
