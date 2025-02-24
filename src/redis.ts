import { disallow } from 'feathers-hooks-common'
import { createClient } from 'redis'
import type { RedisConfiguration } from './configuration'
import { logger } from './logger'
import { ImpressoApplication } from './types'
import { ensureServiceIsFeathersCompatible } from './util/feathers'
import { Application } from '@feathersjs/feathers'
import { HookContext, NextFunction } from '@feathersjs/hooks'

type RedisClient = ReturnType<typeof createClient>

export type { RedisClient }

const getRedisClient = (config: RedisConfiguration): RedisClient => {
  const { host, ...redisConfig } = config
  if (host != null) {
    redisConfig.url = `redis://${host}`
  }
  const client = createClient(redisConfig)
  client.on('error', (err: Error) => logger.error(`Error setting up redis: ${err}`))
  client.on('ready', () => logger.info('Redis connected.'))
  ;(client as any).create = function () {}
  return client
}

/**
 * Redis client container service interface.
 * We use an interface to prevent FeathersJS mixing up some
 * of the redis client methods with the service methods.
 */
export interface IRedisClientContainer {
  client?: RedisClient

  setup(app: ImpressoApplication, path: string): Promise<void>
}

/**
 * Implemnetation.
 */
class RedisClientContainer implements IRedisClientContainer {
  constructor(private _client?: RedisClient) {}
  get client(): RedisClient | undefined {
    return this._client
  }

  async setup(app: ImpressoApplication, path: string) {
    if (this._client == null || this._client.isReady) {
      return
    }
    await this._client.connect()
    logger.info('Redis client connected.')
  }
}

export default (app: ImpressoApplication) => {
  // See if redis is enabled.
  const config = app.get('redis')
  let client: RedisClient | undefined = undefined

  if (config == null) throw new Error('Redis config is missing')

  logger.info("Redis configuration found, let's see if it works...")
  client = getRedisClient(config)
  logger.info('Redis client created.')

  // Create the redis client container.
  const container = new RedisClientContainer(client)
  app.use('redisClient', ensureServiceIsFeathersCompatible(container), {
    methods: [],
  })
  // mark it as external only service
  app.service('redisClient').hooks({
    before: {
      all: disallow('external'),
    },
  })
}

export const init = async (context: HookContext<ImpressoApplication & Application>, next: NextFunction) => {
  const client = context.app.service('redisClient')
  if (client) {
    try {
      await client.setup(context.app, 'redisClient')
      logger.info('Redis is active.')
    } catch (err) {
      logger.error('Error setting up redis:', err)
    }
  } else {
    logger.warn('Redis is not configured. Cannot activate.')
  }
  await next()
}
