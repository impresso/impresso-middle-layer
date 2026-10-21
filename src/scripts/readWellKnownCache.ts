/**
 * Read the well-known cache (Redis) and print its content in a human friendly way.
 *
 * The application stores a few pre-computed datasets ("well known" data) in the cache,
 * see `src/cache.ts` and `src/jobs/rebuildWellKnownCache.ts`. This script is a small
 * inspector for those entries, handy when debugging or when you need to look up
 * a single record (for instance a topic by its id).
 *
 * Usage:
 *   npm run read-cache -- topics                    # list all cached topics
 *   npm run read-cache -- topics <topic-id>         # print one topic (full object)
 *   npm run read-cache -- media-sources             # list all cached media sources
 *   npm run read-cache -- media-sources <source-id> # print one media source
 *   npm run read-cache -- years                     # list all cached years
 *   npm run read-cache -- years <year>              # print one year
 *   npm run read-cache -- meta                      # print the computedAt timestamps
 *   npm run read-cache -- all                       # print counts for every entry
 *
 * Options:
 *   --json   print the raw JSON instead of the compact summary
 *   --help   show this help
 */
import { feathers } from '@feathersjs/feathers'
import configuration from '@/configuration.js'
import configureCache, { WellKnownKeys, WellKnownMetadataKeys } from '@/cache.js'
import type { Cache } from '@/cache.js'
import type { CachedTopic } from '@/models/generated/app/cache.js'
import type { MediaSource } from '@/models/generated/app/entities.js'
import type { IYear } from '@/models/years.model.js'
import type { ImpressoApplication } from '@/types.js'

const log = (message = '') => process.stdout.write(`${message}\n`)

const usage = `Usage: npm run read-cache -- <entry> [id] [--json]

Entries:
  topics [topic-id]                 topics well-known cache
  media-sources [media-source-id]   media sources well-known cache
  years [year]                      years well-known cache
  meta                              computedAt timestamps of the well-known caches
  all                               summary of every well-known cache

Options:
  --json                            print raw JSON
  --help                            show this help`

const readJson = async <T>(cache: Cache, key: string): Promise<T | undefined> => {
  const raw = await cache.get<unknown>(key)
  if (raw == null) return undefined
  // Values are stored as `JSON.stringify(...)` strings, but be defensive and accept objects too.
  return typeof raw === 'string' ? (JSON.parse(raw) as T) : (raw as T)
}

const printJson = (value: unknown) => log(JSON.stringify(value, null, 2))

const truncate = (value: string, maxLength = 60): string =>
  value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value

const topicSummary = (topic: CachedTopic): string =>
  [
    topic.id,
    `[${topic.language}]`,
    truncate(topic.label ?? topic.longLabel ?? '(no label)', 50),
    `items=${topic.contentItemsCount ?? 0}`,
    `related=${topic.relatedTopics?.length ?? 0}`,
    topic.words != null
      ? `words=${topic.words
          .slice(0, 5)
          .map(w => w.w)
          .join(', ')}`
      : '',
  ]
    .filter(part => part !== '')
    .join('  ')

const mediaSourceSummary = (source: MediaSource): string =>
  [
    source.id,
    `[${source.type}]`,
    truncate(source.name),
    source.totals.issues != null ? `issues=${source.totals.issues}` : '',
    source.availableDatesRange != null ? `from=${source.availableDatesRange[0]}` : '',
    source.availableDatesRange != null ? `to=${source.availableDatesRange[1]}` : '',
  ]
    .filter(part => part !== '')
    .join('  ')

const yearSummary = (year: IYear): string => {
  const refs = Object.entries(year.refs ?? {})
    .map(([name, count]) => `${name}=${count}`)
    .join(' ')
  return `${year.y}${refs !== '' ? `  ${refs}` : ''}`
}

const readTopics = async (cache: Cache, id: string | undefined, json: boolean) => {
  const topics = (await readJson<CachedTopic[]>(cache, WellKnownKeys.Topics)) ?? []
  if (topics.length === 0) {
    log(`No topics found in "${WellKnownKeys.Topics}". Is the cache populated?`)
    return
  }
  if (json) return printJson(id != null ? topics.filter(topic => topic.id === id) : topics)

  if (id == null) {
    log(`${topics.length} topics in "${WellKnownKeys.Topics}"`)
    topics.forEach(topic => log(topicSummary(topic)))
    return
  }

  const topic = topics.find(item => item.id === id)
  if (topic == null) {
    log(`Topic "${id}" not found in "${WellKnownKeys.Topics}"`)
    process.exitCode = 1
    return
  }
  printJson(topic)
}

const readMediaSources = async (cache: Cache, id: string | undefined, json: boolean) => {
  const sources = (await readJson<MediaSource[]>(cache, WellKnownKeys.MediaSources)) ?? []
  if (sources.length === 0) {
    log(`No media sources found in "${WellKnownKeys.MediaSources}". Is the cache populated?`)
    return
  }
  if (json) return printJson(id != null ? sources.filter(source => source.id === id) : sources)

  if (id == null) {
    log(`${sources.length} media sources in "${WellKnownKeys.MediaSources}"`)
    sources.forEach(source => log(mediaSourceSummary(source)))
    return
  }

  const source = sources.find(item => item.id === id)
  if (source == null) {
    log(`Media source "${id}" not found in "${WellKnownKeys.MediaSources}"`)
    process.exitCode = 1
    return
  }
  printJson(source)
}

const readYears = async (cache: Cache, id: string | undefined, json: boolean) => {
  const years = (await readJson<Record<string, IYear>>(cache, WellKnownKeys.Years)) ?? {}
  const entries = Object.entries(years)
  if (entries.length === 0) {
    log(`No years found in "${WellKnownKeys.Years}". Is the cache populated?`)
    return
  }
  if (json) return printJson(id != null ? (years[id] ?? null) : years)

  if (id == null) {
    log(`${entries.length} years in "${WellKnownKeys.Years}"`)
    entries
      .map(([, year]) => year)
      .sort((a, b) => a.y - b.y)
      .forEach(year => log(yearSummary(year)))
    return
  }

  const year = years[id]
  if (year == null) {
    log(`Year "${id}" not found in "${WellKnownKeys.Years}"`)
    process.exitCode = 1
    return
  }
  printJson(year)
}

const readMeta = async (cache: Cache) => {
  const entries = await Promise.all(
    Object.entries(WellKnownMetadataKeys).map(async ([name, key]) => {
      const computedAt = await cache.get<string>(key)
      return { name, key, computedAt: computedAt ?? '(not set)' }
    })
  )
  log('Well-known cache metadata')
  entries.forEach(({ name, key, computedAt }) => log(`${name}  ${computedAt}  (${key})`))
}

const readAll = async (cache: Cache) => {
  const [topics, mediaSources, years] = await Promise.all([
    readJson<CachedTopic[]>(cache, WellKnownKeys.Topics),
    readJson<MediaSource[]>(cache, WellKnownKeys.MediaSources),
    readJson<Record<string, IYear>>(cache, WellKnownKeys.Years),
  ])
  log(`${WellKnownKeys.Topics}: ${topics?.length ?? 0}`)
  log(`${WellKnownKeys.MediaSources}: ${mediaSources?.length ?? 0}`)
  log(`${WellKnownKeys.Years}: ${Object.keys(years ?? {}).length}`)
  log()
  await readMeta(cache)
}

const main = async () => {
  const args = process.argv.slice(2)
  const json = args.includes('--json')
  const positional = args.filter(arg => !arg.startsWith('--'))
  const [entry, id] = positional

  if (args.includes('--help') || entry == null) {
    log(usage)
    return
  }

  // Only load the configuration needed by the cache, avoiding the full app (logger, services, ...).
  const app: ImpressoApplication = feathers()
  app.configure(configuration)
  if (app.get('cache')?.enabled !== true) {
    throw new Error('Cache is disabled in the configuration (set `cache.enabled` to true).')
  }
  configureCache(app)

  const cache = app.get('cacheManager')
  try {
    switch (entry) {
      case 'topics':
      case 'topic':
        await readTopics(cache, id, json)
        break
      case 'media-sources':
      case 'mediaSources':
        await readMediaSources(cache, id, json)
        break
      case 'years':
      case 'year':
        await readYears(cache, id, json)
        break
      case 'meta':
        await readMeta(cache)
        break
      case 'all':
        await readAll(cache)
        break
      default:
        log(`Unknown entry "${entry}"\n`)
        log(usage)
        process.exitCode = 1
    }
  } finally {
    await cache.disconnect()
  }
}

main().catch(error => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
