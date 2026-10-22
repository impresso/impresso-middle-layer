/**
 * Write (rebuild) the well-known cache entries (Redis).
 *
 * The application stores a few pre-computed datasets ("well known" data) in the
 * cache, see `src/cache.ts` and `src/jobs/rebuildWellKnownCache.ts`. This script
 * is the write-side counterpart of `src/scripts/readWellKnownCache.ts`: it runs
 * the very same jobs the rebuild job runs, but for a single entry and from the
 * command line, without the admin service and without BullMQ.
 *
 * Every `update*` job returns early when its cache key already exists, so the
 * existing entry is kept unless `--force` is passed. With `--force`, the key
 * and its `computedAt` metadata are deleted first (as `clearWellKnownCache`
 * does in `src/jobs/rebuildWellKnownCache.ts`).
 *
 * Usage:
 *   npm run write-cache -- topics                     # rebuild the topics cache
 *   npm run write-cache -- media-sources --force      # rebuild it, overwriting
 *   npm run write-cache -- years                      # rebuild the years cache
 *   npm run write-cache -- special-membership-access  # rebuild the access cache
 *   npm run write-cache -- all                        # rebuild every entry
 *   npm run write-cache -- --help                     # show this help
 *
 * Options:
 *   --force   delete the existing entry (and its metadata) before rebuilding
 *   --help    show this help
 *
 * Environment:
 *   The `.env` file of the repository is used: the `write-cache` npm script
 *   passes `--env-file=./.env`, and the script loads the same file with dotenv
 *   when it is run directly. The variables referenced by the configuration
 *   (`${DB_HOSTNAME}`, `${SOLR_BASE_URL}`, ...) are read from there.
 */
import { createApp } from '@/appBuilder.js'
import configureCache, { WellKnownKeys, WellKnownMetadataKeys } from '@/cache.js'
import type { Cache } from '@/cache.js'
import { init as initSimpleSolrClient } from '@/internalServices/simpleSolr.js'
import updateMediaSourcesCache from '@/jobs/updateMediaSourcesCache.js'
import updateSpecialMembershipAccessCache from '@/jobs/updateSpecialMembershipAccessCache.js'
import updateTopicsCache from '@/jobs/updateTopicsCache.js'
import updateYearsCache from '@/jobs/updateYears.js'
import configureSequelize from '@/sequelize.js'
import type { ImpressoApplication } from '@/types.js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'

/**
 * Load the `.env` file of the repository, when it exists, so the script can
 * also be run directly (`npx tsx src/scripts/writeWellKnownCache.ts`) and not
 * only through the `write-cache` npm script (which passes `--env-file=./.env`).
 *
 * Variables already present in the environment always win.
 */
dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true })

const log = (message = '') => process.stdout.write(`${message}\n`)

type CacheJob = (app: ImpressoApplication) => Promise<void>

interface WellKnownEntry {
  /** name used on the command line */
  name: string
  /** human readable name, used in the output */
  label: string
  /** cache key holding the data */
  key: string
  /** cache key holding the `computedAt` timestamp */
  metadataKey: string
  /** job rebuilding the entry */
  job: CacheJob
  /** the job needs the Solr client */
  needsSolr: boolean
  /** the job needs the database */
  needsDatabase: boolean
}

const entries: WellKnownEntry[] = [
  {
    name: 'media-sources',
    label: 'Media sources',
    key: WellKnownKeys.MediaSources,
    metadataKey: WellKnownMetadataKeys.MediaSourcesComputedAt,
    job: updateMediaSourcesCache,
    needsSolr: true,
    needsDatabase: true,
  },
  {
    name: 'years',
    label: 'Years',
    key: WellKnownKeys.Years,
    metadataKey: WellKnownMetadataKeys.YearsComputedAt,
    job: updateYearsCache,
    needsSolr: true,
    needsDatabase: false,
  },
  {
    name: 'topics',
    label: 'Topics',
    key: WellKnownKeys.Topics,
    metadataKey: WellKnownMetadataKeys.TopicsComputedAt,
    job: updateTopicsCache,
    needsSolr: true,
    needsDatabase: false,
  },
  {
    name: 'special-membership-access',
    label: 'Special membership access',
    key: WellKnownKeys.SpecialMembershipAccessByBitmapPosition,
    metadataKey: WellKnownMetadataKeys.SpecialMembershipAccessComputedAt,
    job: updateSpecialMembershipAccessCache,
    needsSolr: false,
    needsDatabase: true,
  },
]

const entriesByName = new Map<string, WellKnownEntry>(entries.map(entry => [entry.name, entry] as const))

const usage = `Usage: npm run write-cache -- <entry> [--force]

Entries:
  media-sources               media sources well-known cache
  years                       years well-known cache
  topics                      topics well-known cache
  special-membership-access   special membership access well-known cache
  all                         every entry listed above

Options:
  --force                     delete the existing entry before rebuilding it
  --help                      show this help`

/**
 * Bootstrap the minimum app needed by the selected jobs: configuration,
 * logger, cache, and (only when needed) the Solr client and the database.
 */
const bootstrap = async (needsSolr: boolean, needsDatabase: boolean) => {
  const app = createApp()

  if (app.get('cache')?.enabled !== true) {
    throw new Error('Cache is disabled in the configuration (set `cache.enabled` to true).')
  }
  configureCache(app)

  if (needsSolr) initSimpleSolrClient(app)
  if (needsDatabase) await configureSequelize(app)

  return app
}

const writeEntry = async (app: ImpressoApplication, cache: Cache, entry: WellKnownEntry, force: boolean) => {
  const existing = await cache.get(entry.key)
  if (existing != null) {
    if (!force) {
      log(`⏭️  "${entry.label}" is already cached ("${entry.key}"), nothing to do. Use --force to rebuild it.`)
      return
    }
    log(`🧹 Deleting "${entry.key}" and "${entry.metadataKey}"`)
    await cache.del(entry.key)
    await cache.del(entry.metadataKey)
  }

  log(`➡️ Rebuilding "${entry.label}" ("${entry.key}")`)
  await entry.job(app)

  const raw = await cache.get<string>(entry.key)
  if (raw == null) {
    log(`❌ "${entry.label}" was not written to the cache.`)
    process.exitCode = 1
    return
  }

  const computedAt = await cache.get<string>(entry.metadataKey)
  log(`✅ "${entry.label}" rebuilt: ${raw.length} bytes${computedAt != null ? `, computedAt ${computedAt}` : ''}`)
}

const main = async () => {
  const args = process.argv.slice(2)
  const knownFlags = ['--force', '--help', '-h']
  const unknownFlags = args.filter(arg => arg.startsWith('-') && !knownFlags.includes(arg))
  if (unknownFlags.length > 0) {
    log(`Unknown option "${unknownFlags[0]}"\n`)
    log(usage)
    process.exitCode = 1
    return
  }

  const help = args.includes('--help') || args.includes('-h')
  const force = args.includes('--force')
  const positional = args.filter(arg => !arg.startsWith('-'))

  if (help || positional.length === 0) {
    log(usage)
    process.exitCode = help ? 0 : 1
    return
  }

  const [name, ...extra] = positional
  if (extra.length > 0) {
    log(`Unexpected argument "${extra[0]}"\n`)
    log(usage)
    process.exitCode = 1
    return
  }

  const selected: WellKnownEntry[] =
    name === 'all' ? entries : [entriesByName.get(name)].filter((entry): entry is WellKnownEntry => entry != null)
  if (selected.length === 0) {
    log(`Unknown entry "${name}"\n`)
    log(usage)
    process.exitCode = 1
    return
  }

  const needsSolr = selected.some(entry => entry.needsSolr)
  const needsDatabase = selected.some(entry => entry.needsDatabase)

  const app = await bootstrap(needsSolr, needsDatabase)
  const cache = app.get('cacheManager')
  try {
    for (const entry of selected) {
      await writeEntry(app, cache, entry, force)
    }
  } finally {
    await cache.disconnect()
    await app.get('sequelizeClient')?.close()
  }
}

main().catch(error => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
