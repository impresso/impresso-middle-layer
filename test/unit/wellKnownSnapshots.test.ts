import { strict as assert } from 'assert'
import sinon from 'sinon'
import { createCache } from 'cache-manager'
import { Keyv } from 'keyv'
import { feathers } from '@feathersjs/feathers'
import { WellKnownKeys, WellKnownMetadataKeys } from '@/cache.js'
import { createSnapshotLoader, getWellKnownSnapshots } from '@/internalServices/wellKnownSnapshots.js'
import { buildResolvers } from '@/internalServices/cachedResolvers.js'
import { MediaSources } from '@/services/media-sources/media-sources.class.js'
import type { AppServices } from '@/types.js'
import type { Configuration } from '@/configuration.js'
import { GDL, JDG } from '../mockData/mediaSources.js'

describe('well-known snapshots', () => {
  const makeCache = () => createCache({ stores: [new Keyv()] })
  let clock: sinon.SinonFakeTimers

  beforeEach(() => {
    clock = sinon.useFakeTimers({ toFake: ['Date'] })
  })
  afterEach(() => sinon.restore())

  it('coalesces concurrent cold loads and version checks, reloading only changed versions', async () => {
    const cache = makeCache()
    await cache.set('data', '[1]')
    await cache.set('version', 'v1')
    const get = sinon.spy(cache, 'get')
    const decode = sinon.spy((raw: string | undefined): number[] => JSON.parse(raw ?? '[]'))
    const load = createSnapshotLoader(cache, 'data', 'version', decode)
    const results = await Promise.all(Array.from({ length: 100 }, () => load()))
    assert.equal(get.callCount, 2)
    assert.equal(decode.callCount, 1)
    assert.ok(results.every(value => value === results[0]))
    clock.tick(30_000)
    await Promise.all([load(), load()])
    assert.equal(get.callCount, 3)
    assert.equal(decode.callCount, 1)
    await cache.set('version', 'v2')
    await cache.set('data', '[2]')
    assert.deepEqual(await load(), [1])
    clock.tick(30_000)
    assert.deepEqual(await load(), [2])
    assert.equal(decode.callCount, 2)
  })

  it('coalesces loads that take longer than the check interval', async () => {
    const cache = makeCache()
    let release: (() => void) | undefined
    const waiting = new Promise<void>(resolve => {
      release = resolve
    })
    const get = sinon.stub(cache, 'get').callsFake(async () => {
      await waiting
      return undefined
    })
    const load = createSnapshotLoader(cache, 'data', 'version', () => [])
    const first = load()
    clock.tick(60_000)
    assert.equal(load(), first)
    release?.()
    await first
    assert.equal(get.callCount, 2)
  })

  it('reloads unchanged versions periodically and missing metadata every interval', async () => {
    const cache = makeCache()
    await cache.set('data', '1')
    await cache.set('version', 'v1')
    const load = createSnapshotLoader(cache, 'data', 'version', raw => Number(raw))
    assert.equal(await load(), 1)
    await cache.set('data', '2')
    clock.tick(300_000)
    assert.equal(await load(), 2)
    await cache.del('version')
    await cache.set('data', '3')
    clock.tick(30_000)
    assert.equal(await load(), 3)
    await cache.set('data', '4')
    clock.tick(30_000)
    assert.equal(await load(), 4)
  })

  it('does not retain missing blobs as a versioned snapshot', async () => {
    const cache = makeCache()
    await cache.set('version', 'v1')
    const load = createSnapshotLoader(cache, 'data', 'version', raw => raw ?? 'empty')
    assert.equal(await load(), 'empty')
    await cache.set('data', 'ready')
    clock.tick(30_000)
    assert.equal(await load(), 'ready')
  })

  it('bounds failed-load retries and recovers after malformed data or Redis errors', async () => {
    const cache = makeCache()
    await cache.set('data', '{')
    const load = createSnapshotLoader(cache, 'data', 'version', raw => JSON.parse(raw ?? '[]'))
    await assert.rejects(load(), SyntaxError)
    await cache.set('data', '[1]')
    await assert.rejects(load(), SyntaxError)
    clock.tick(30_000)
    assert.deepEqual(await load(), [1])
    const get = sinon.stub(cache, 'get').rejects(new Error('offline'))
    clock.tick(30_000)
    await assert.rejects(load(), /offline/)
    await assert.rejects(load(), /offline/)
    assert.equal(get.callCount, 1)
    get.restore()
    clock.tick(30_000)
    assert.deepEqual(await load(), [1])
  })

  it('shares media data across services, isolates mutations, and preserves listing behavior', async () => {
    const cache = makeCache()
    await cache.set(WellKnownKeys.MediaSources, JSON.stringify([JDG, GDL]))
    const get = sinon.spy(cache, 'get')
    const service = new MediaSources(cache)
    const otherService = new MediaSources(cache)
    const source = await service.get('GDL')
    source.languageCodes.push('de')
    const lookup = await service.getLookup()
    lookup.GDL.name = 'changed'
    const page = await service.findMediaSources({ term: 'gazette', limit: 1, offset: 0 })
    assert.equal(page.pagination.total, 1)
    assert.equal(page.data[0].name, GDL.name)
    page.data[0].name = 'also changed'
    assert.deepEqual(await otherService.get('GDL'), GDL)
    assert.equal(await service.getMediaSource('unknown'), undefined)
    assert.equal(get.callCount, 2)
    const sorted = await service.findMediaSources({ order_by: '-name', limit: 20, offset: 0 })
    assert.deepEqual(
      sorted.data.map(source => source.id),
      ['JDG', 'GDL']
    )
  })

  it('shares topics and years across resolver factories without sharing returned objects', async () => {
    const cache = makeCache()
    await cache.set(
      WellKnownKeys.Topics,
      JSON.stringify([
        { id: 't1', language: 'fr', words: [{ w: 'original', p: 1 }] },
        { id: 't1', language: 'de' },
      ])
    )
    await cache.set(WellKnownKeys.Years, JSON.stringify({ '1900': { count: 5 } }))
    const app = feathers<AppServices & Record<string, unknown>, Configuration>()
    app.set('cacheManager', cache)
    app.use('media-sources', new MediaSources(cache))
    const unexpectedCollectionLookup = async (): Promise<never> => {
      throw new Error('Unexpected collection lookup')
    }
    app.use('collections', {
      get: unexpectedCollectionLookup,
      find: unexpectedCollectionLookup,
      create: unexpectedCollectionLookup,
      patch: unexpectedCollectionLookup,
      remove: unexpectedCollectionLookup,
      findByContentItems: unexpectedCollectionLookup,
      getInternal: unexpectedCollectionLookup,
    })
    app.use('special-membership-plans', {
      async get() {
        throw new Error('Unexpected membership lookup')
      },
    })
    const a = buildResolvers(app)
    const b = buildResolvers(app)
    const get = sinon.spy(cache, 'get')
    const topic = await a.topic('t1')
    assert.ok(topic?.words)
    topic.words[0].w = 'changed'
    assert.equal((await b.topic('t1'))?.words?.[0].w, 'original')
    assert.equal((await b.topic('t1'))?.language, 'fr')
    assert.equal(await b.topic('unknown'), undefined)
    const year = await a.year('1900')
    assert.ok(year)
    year.id = 1901
    assert.equal((await b.year('1900'))?.id, 1900)
    assert.equal(await b.year('unknown'), undefined)
    assert.equal((await getWellKnownSnapshots(cache).years()).get('1900')?.id, undefined)
    assert.equal(get.callCount, 4)
    assert.notEqual(getWellKnownSnapshots(cache), getWellKnownSnapshots(makeCache()))
    await cache.set(WellKnownMetadataKeys.TopicsComputedAt, 'v2')
    await cache.set(WellKnownKeys.Topics, '[]')
    clock.tick(30_000)
    assert.equal(await b.topic('t1'), undefined)
  })
})
