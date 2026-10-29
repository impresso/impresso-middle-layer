import type { Cache } from '@/cache.js'
import { WellKnownKeys, WellKnownMetadataKeys } from '@/cache.js'
import type { MediaSource, Year } from '@/models/generated/app/entities.js'
import type { CachedTopic } from '@/models/generated/app/cache.js'
import { getLocalRevision, readWellKnownEntry } from './wellKnownCache.js'

const RefreshIntervalMs = 30_000
const MaxSnapshotAgeMs = 300_000

/** One retained promise coalesces loads, including failed cold loads, until the next check. */
export const createSnapshotLoader = <T>(
  cache: Pick<Cache, 'get'>,
  key: string,
  metadataKey: string,
  decode: (value: string | undefined) => T
): (() => Promise<T>) => {
  let pending: Promise<T> | undefined
  let snapshot: { value: T; version: string | undefined; loadedAt: number } | undefined
  let nextCheckAt = 0
  let revision = getLocalRevision(cache, key)

  const refresh = async (loadRevision: number): Promise<T> => {
    const { version, data: raw } = await readWellKnownEntry(cache, key, metadataKey)
    if (
      snapshot &&
      version != null &&
      version === snapshot.version &&
      Date.now() - snapshot.loadedAt < MaxSnapshotAgeMs
    ) {
      return snapshot.value
    }
    const value = decode(raw)
    // Missing data is checked again at the next interval, even if metadata remains unchanged.
    if (loadRevision === getLocalRevision(cache, key)) {
      snapshot = raw == null ? undefined : { value, version, loadedAt: Date.now() }
    }
    return value
  }

  return () => {
    const currentRevision = getLocalRevision(cache, key)
    if (pending && revision === currentRevision && Date.now() < nextCheckAt) return pending
    revision = currentRevision
    // Infinity prevents a second load even if a slow Redis read spans an interval.
    nextCheckAt = Infinity
    const loadRevision = revision
    pending = refresh(loadRevision).finally(() => {
      if (revision === loadRevision) nextCheckAt = Date.now() + RefreshIntervalMs
    })
    return pending
  }
}

export interface MediaSourcesSnapshot {
  sources: MediaSource[]
  byId: Map<string, MediaSource>
}

const createSnapshots = (cache: Cache) => ({
  mediaSources: createSnapshotLoader(
    cache,
    WellKnownKeys.MediaSources,
    WellKnownMetadataKeys.MediaSourcesComputedAt,
    raw => {
      const sources: MediaSource[] = JSON.parse(raw ?? '[]')
      return { sources, byId: new Map(sources.map(source => [source.id, source])) } satisfies MediaSourcesSnapshot
    }
  ),
  topics: createSnapshotLoader(cache, WellKnownKeys.Topics, WellKnownMetadataKeys.TopicsComputedAt, raw => {
    const topics: CachedTopic[] = JSON.parse(raw ?? '[]')
    const byId = new Map<string, CachedTopic>()
    for (const topic of topics) {
      if (!byId.has(topic.id)) byId.set(topic.id, topic)
    }
    return byId
  }),
  years: createSnapshotLoader(cache, WellKnownKeys.Years, WellKnownMetadataKeys.YearsComputedAt, raw => {
    const years: Record<string, Year> = JSON.parse(raw ?? '{}')
    return new Map(Object.entries(years))
  }),
})

const snapshotsByCache = new WeakMap<Cache, ReturnType<typeof createSnapshots>>()

/** Shared by services and all resolver factories using the application's cache manager.
 * Snapshots are internal: callers must copy entries before returning them to mutable consumers.
 */
export const getWellKnownSnapshots = (cache: Cache) => {
  let snapshots = snapshotsByCache.get(cache)
  if (!snapshots) {
    snapshots = createSnapshots(cache)
    snapshotsByCache.set(cache, snapshots)
  }
  return snapshots
}
