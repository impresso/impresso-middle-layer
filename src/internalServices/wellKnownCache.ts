import { randomUUID } from 'node:crypto'
import type { Cache } from '@/cache.js'
import { WellKnownKeys, WellKnownMetadataKeys } from '@/cache.js'
import { getLogger } from '@/logger.js'

const logger = getLogger(['cache', 'well-known'])

/** Milliseconds, as required by cache-manager/Keyv. */
export const WellKnownCacheTtlMs = 100 * 24 * 60 * 60 * 1000
export const publishedEntryKey = (key: string) => `${key}:snapshot`

export interface PreparedWellKnownEntry {
  key: string
  data: string
}

interface PublishedWellKnownEntry extends PreparedWellKnownEntry {
  version: string
  computedAt: string
}

// When adding an entry, update this pairing, the CLI entries table in
// scripts/writeWellKnownCache.ts, and docs/specs/write-well-known-cache.md together.
const metadataKeys = new Map<string, string>([
  [WellKnownKeys.MediaSources, WellKnownMetadataKeys.MediaSourcesComputedAt],
  [WellKnownKeys.Topics, WellKnownMetadataKeys.TopicsComputedAt],
  [WellKnownKeys.Years, WellKnownMetadataKeys.YearsComputedAt],
  [WellKnownKeys.SpecialMembershipAccessByBitmapPosition, WellKnownMetadataKeys.SpecialMembershipAccessComputedAt],
])

const localRevisions = new WeakMap<object, Map<string, number>>()
export const getLocalRevision = (cache: object, key: string) => localRevisions.get(cache)?.get(key) ?? 0

/** The single published record is authoritative. Old keys remain readable until the first rebuild. */
export const readWellKnownEntry = async (
  cache: Pick<Cache, 'get'>,
  key: string,
  metadataKey: string | undefined = metadataKeys.get(key)
) => {
  const published = await cache.get<PublishedWellKnownEntry>(publishedEntryKey(key))
  if (published != null) return published
  const computedAt = metadataKey == null ? undefined : await cache.get<string>(metadataKey)
  const data = await cache.get<string>(key)
  return { key, data, computedAt, version: computedAt }
}

export const readWellKnownComputedAt = async (cache: Pick<Cache, 'get'>, metadataKey: string) => {
  const entry = [...metadataKeys].find(([, value]) => value === metadataKey)
  if (entry == null) return cache.get<string>(metadataKey)
  const published = await cache.get<PublishedWellKnownEntry>(publishedEntryKey(entry[0]))
  if (published != null) return published.data == null ? undefined : published.computedAt
  return cache.get<string>(metadataKey)
}

/** One SET publishes data and its version together; a failed computation/write leaves the old record intact. */
export const publishWellKnownEntry = async (cache: Cache, entry: PreparedWellKnownEntry): Promise<void> => {
  const [store] = cache.stores
  if (cache.stores.length !== 1 || store == null) {
    throw new Error('Well-known cache publication requires a single cache store')
  }
  const published: PublishedWellKnownEntry = {
    ...entry,
    version: randomUUID(),
    computedAt: new Date().toISOString(),
  }
  // cache-manager discards Keyv's boolean write result. Check it here so a failed
  // publication cannot look successful, while ordinary cache writes stay best-effort.
  const stored = await store.set(publishedEntryKey(entry.key), published, WellKnownCacheTtlMs)
  if (!stored) throw new Error(`Failed to publish well-known cache entry: ${entry.key}`)
  let revisions = localRevisions.get(cache)
  if (!revisions) {
    revisions = new Map()
    localRevisions.set(cache, revisions)
  }
  revisions.set(entry.key, (revisions.get(entry.key) ?? 0) + 1)
  logger.info(`Published well-known cache entry ${entry.key} (${entry.data.length} bytes)`)
}

export interface UpdateWellKnownCacheOptions {
  force?: boolean
}

/** A preparation failure leaves every live entry untouched. Publication is atomic per dataset. */
export const rebuildWellKnownEntries = async (
  cache: Cache,
  prepare: (() => Promise<PreparedWellKnownEntry>)[]
): Promise<void> => {
  const entries = await Promise.all(prepare.map(load => load()))
  for (const entry of entries) await publishWellKnownEntry(cache, entry)
}

export const updateWellKnownEntry = async (
  cache: Cache,
  key: string,
  prepare: () => Promise<PreparedWellKnownEntry>,
  { force = false }: UpdateWellKnownCacheOptions = {}
): Promise<void> => {
  if (!force && (await readWellKnownEntry(cache, key)).data != null) return
  await publishWellKnownEntry(cache, await prepare())
}
