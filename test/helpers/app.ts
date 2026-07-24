import { Sequelize } from 'sequelize'
import { ImpressoApplication } from '@/types.js'
import { CeleryClient } from '@/celery.js'
import { RedisClient } from '@/redis.js'
import type { CeleryCall, RedisSetExCall } from './database.js'

/**
 * Mutable bag of "get" and "service" handlers being assembled by features.
 * Each feature contributes its own keys; later features can still see what
 * earlier features registered (e.g. to wrap/extend them).
 */
export interface TestAppContext {
  getHandlers: Record<string, (...args: any[]) => any>
  serviceHandlers: Record<string, (...args: any[]) => any>
  /** Arbitrary extra state a feature wants to expose to the test (e.g. sequelize, captured calls) */
  extras: Record<string, any>
  /** Cleanup callbacks, run in order by teardownTestApp */
  teardownFns: (() => Promise<void> | void)[]
}

/**
 * A Feature is a function that mutates/extends a TestAppContext.
 * It can register `get`/`service` handlers and stash whatever state it wants
 * in `extras` (and optionally register a teardown function).
 */
export type TestAppFeature<TExtra extends Record<string, any> = Record<string, any>> = (
  ctx: TestAppContext
) => TExtra | void

/**
 * Composes any number of features into a single mock ImpressoApplication.
 *
 * @example
 * const { app, sequelize } = setupTestApp(withDatabase(), withSolr())
 *
 * @example
 * const { app, sequelize, celeryRunCalls, redisSetExCalls } = setupTestApp(
 *   withDatabase(),
 *   withRedisCelery()
 * )
 */
export function setupTestApp<TFeatures extends TestAppFeature[]>(
  ...features: TFeatures
): { app: ImpressoApplication; teardown: () => Promise<void> } & UnionToIntersection<
  Exclude<ReturnType<TFeatures[number]>, void>
> {
  const ctx: TestAppContext = {
    getHandlers: {},
    serviceHandlers: {},
    extras: {},
    teardownFns: [],
  }

  for (const feature of features) {
    const extra = feature(ctx)
    if (extra) Object.assign(ctx.extras, extra)
  }

  const app = {
    get: (key: string) => {
      const handler = ctx.getHandlers[key]
      return handler ? handler() : undefined
    },
    service: (name: string) => {
      const handler = ctx.serviceHandlers[name]
      if (handler) return handler()
      throw new Error(`Unexpected service request: ${name}`)
    },
  } as ImpressoApplication

  const teardown = async () => {
    // run teardowns in reverse registration order
    for (const fn of [...ctx.teardownFns].reverse()) {
      await fn()
    }
  }

  return { app, teardown, ...ctx.extras } as any
}

/** Convenience alias if you prefer calling teardown via a free function */
export async function teardownTestApp(result: { teardown: () => Promise<void> }): Promise<void> {
  await result.teardown()
}

// Small utility type to flatten the union of feature return types into one
// intersected shape, so `setupTestApp(withDatabase(), withSolr())` exposes
// `sequelize`, `app`, `mockSolr`, etc. all on the same returned object.
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never

/* -------------------------------------------------------------------------
 * Features
 * -----------------------------------------------------------------------*/

/**
 * Feature: in-memory SQLite database, registered under `sequelizeClient`.
 */
export function withDatabase(options?: { logging?: boolean | ((sql: string) => void) }): TestAppFeature<{
  sequelize: Sequelize
}> {
  return ctx => {
    const sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: ':memory:',
      logging: options?.logging ?? false,
      define: {
        timestamps: false,
      },
    })

    ctx.getHandlers['sequelizeClient'] = () => sequelize
    ctx.teardownFns.push(() => sequelize.close())

    return { sequelize }
  }
}

/**
 * Feature: mocked Celery + Redis clients, registered under `celeryClient`
 * and `redisClient` (both via `get` and `service`, matching legacy behavior).
 * Also registers `magicLink`, `authentication`, and `callbackUrls` defaults,
 * matching the legacy `setupTestDatabaseRedisCelery` get() switch.
 *
 * Captured calls are exposed as `celeryRunCalls` / `redisSetExCalls` so tests
 * can assert on them.
 */
export function withRedisCelery(): TestAppFeature<{
  celeryRunCalls: CeleryCall[]
  redisSetExCalls: Record<string, RedisSetExCall>
}> {
  return ctx => {
    const celeryRunCalls: CeleryCall[] = []
    const redisSetExCalls: Record<string, RedisSetExCall> = {}

    const celeryClient = {
      run: async (task: { task: string; args: any[] }) => {
        celeryRunCalls.push(task)
        return {} as any
      },
    } as CeleryClient

    const redisClient = {
      client: {
        setEx: async (key: string, expiration: number, value: string) => {
          redisSetExCalls[key] = { key, expiration, value }
          return 'OK'
        },
        get: async (key: string) => {
          const record = redisSetExCalls[key]
          return record ? record.value : null
        },
        del: async (key: string) => {
          delete redisSetExCalls[key]
          return 1
        },
      } as RedisClient,
    }

    ctx.getHandlers['celeryClient'] = () => celeryClient
    ctx.getHandlers['redisClient'] = () => redisClient
    ctx.getHandlers['magicLink'] = () => ({ secret: 'test-magic-link-secret', expiration: 300 })
    ctx.getHandlers['authentication'] = () => ({ secret: 'test-secret-key' })
    ctx.getHandlers['callbackUrls'] = () => ({ magicLink: 'http://test-callback-url.com/magic-link' })

    ctx.serviceHandlers['redisClient'] = () => redisClient

    return { celeryRunCalls, redisSetExCalls }
  }
}

/**
 * Feature: mocked cache manager, registered under `cacheManager`.
 * Provides in-memory cache with TTL expiration.
 */
export function withCacheManager(): TestAppFeature<{
  cacheManager: {
    get: <T = any>(key: string) => Promise<T | undefined>
    set: (key: string, value: any, ttl?: number) => Promise<void>
  }
}> {
  return ctx => {
    const cache = new Map<string, { value: any; expireAt: number }>()

    const cacheManager = {
      get: async <T = any>(key: string): Promise<T | undefined> => {
        const entry = cache.get(key)
        if (!entry) return undefined
        if (entry.expireAt < Date.now()) {
          cache.delete(key)
          return undefined
        }
        return entry.value as T
      },
      set: async (key: string, value: any, ttl?: number): Promise<void> => {
        const expireAt = ttl ? Date.now() + ttl : Date.now() + 60000 // default 1 minute
        cache.set(key, { value, expireAt })
      },
    }

    ctx.getHandlers['cacheManager'] = () => cacheManager

    return { cacheManager }
  }
}

/**
 * Feature: mocked Solr client, registered as the `simpleSolrClient` service,
 * plus a stub `media-sources` service and `solrConfiguration`/`features` get()
 * handlers. Captured request bodies are exposed via `solrSelectCalls`.
 */
export function withSolr(): TestAppFeature<{
  mockSolr: {
    namespaces: Record<string, string>
    select: (namespace: string, args: { body: Record<string, any> }) => Promise<any>
  }
  solrSelectCalls: Record<string, any>[]
}> {
  return ctx => {
    const solrSelectCalls: Record<string, any>[] = []

    const mockSolr = {
      namespaces: {
        TextReusePassages: 'tr_passages',
      },
      select: async (_namespace: string, { body }: { body: Record<string, any> }) => {
        solrSelectCalls.push(body)
        return { response: { docs: [], numFound: 0 } }
      },
    }

    ctx.serviceHandlers['simpleSolrClient'] = () => mockSolr
    ctx.serviceHandlers['media-sources'] = () => ({ getLookup: async () => ({}) })
    ctx.getHandlers['solrConfiguration'] = () => ({ namespaces: {} })
    ctx.getHandlers['features'] = () => ({})

    return { mockSolr, solrSelectCalls }
  }
}
