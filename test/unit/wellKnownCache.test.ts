import { strict as assert } from 'assert'
import sinon from 'sinon'
import { createCache } from 'cache-manager'
import { Keyv } from 'keyv'
import { WellKnownKeys, WellKnownMetadataKeys } from '@/cache.js'
import {
  publishWellKnownEntry,
  publishedEntryKey,
  readWellKnownEntry,
  readWellKnownComputedAt,
  rebuildWellKnownEntries,
  updateWellKnownEntry,
} from '@/internalServices/wellKnownCache.js'
import { createSnapshotLoader } from '@/internalServices/wellKnownSnapshots.js'

describe('well-known cache publication', () => {
  const makeCache = () => createCache({ stores: [new Keyv({ throwOnErrors: true })] })
  afterEach(() => sinon.restore())

  it('publishes data, version, and timestamp with one write and reads legacy data before migration', async () => {
    const cache = makeCache()
    await cache.set(WellKnownKeys.Topics, '[1]')
    await cache.set(WellKnownMetadataKeys.TopicsComputedAt, 'old')
    assert.equal((await readWellKnownEntry(cache, WellKnownKeys.Topics)).data, '[1]')
    const set = sinon.spy(cache.stores[0], 'set')
    const del = sinon.spy(cache, 'del')
    await publishWellKnownEntry(cache, { key: WellKnownKeys.Topics, data: '[2]' })
    const record = await readWellKnownEntry(cache, WellKnownKeys.Topics)
    assert.equal(record.data, '[2]')
    assert.ok(record.version)
    assert.ok(record.computedAt)
    assert.equal(await readWellKnownComputedAt(cache, WellKnownMetadataKeys.TopicsComputedAt), record.computedAt)
    assert.equal(set.callCount, 1)
    assert.equal(set.firstCall.args[0], publishedEntryKey(WellKnownKeys.Topics))
    assert.equal(del.callCount, 0)
  })

  it('does not report a timestamp for a published record missing its data', async () => {
    const cache = makeCache()
    await cache.set(WellKnownMetadataKeys.TopicsComputedAt, 'legacy')
    await cache.set(publishedEntryKey(WellKnownKeys.Topics), { version: 'v1', computedAt: 'incomplete' })
    assert.equal(await readWellKnownComputedAt(cache, WellKnownMetadataKeys.TopicsComputedAt), undefined)
  })

  it('invalidates local readers immediately and other instances within 30 seconds, even with identical timestamps', async () => {
    const clock = sinon.useFakeTimers({ toFake: ['Date'] })
    const store = new Keyv()
    const local = createCache({ stores: [store] })
    const remote = createCache({ stores: [store] })
    await publishWellKnownEntry(local, { key: 'data', data: '1' })
    const before = await readWellKnownEntry(local, 'data')
    const decode = sinon.spy((raw: string | undefined) => Number(raw))
    const localLoad = createSnapshotLoader(local, 'data', 'meta', decode)
    const remoteLoad = createSnapshotLoader(remote, 'data', 'meta', decode)
    assert.equal(await localLoad(), 1)
    assert.equal(await remoteLoad(), 1)
    await publishWellKnownEntry(local, { key: 'data', data: '2' })
    const after = await readWellKnownEntry(local, 'data')
    assert.equal(after.computedAt, before.computedAt)
    assert.notEqual(after.version, before.version)
    assert.equal(await localLoad(), 2)
    assert.equal(await remoteLoad(), 1)
    clock.tick(30_000)
    assert.equal(await remoteLoad(), 2)
    const get = sinon.spy(remote, 'get')
    clock.tick(30_000)
    assert.equal(await remoteLoad(), 2)
    assert.equal(get.callCount, 1)
    assert.equal(decode.callCount, 4)
  })

  it('keeps the live entry readable during preparation and skips existing entries unless forced', async () => {
    const cache = makeCache()
    await publishWellKnownEntry(cache, { key: 'data', data: 'old' })
    let complete: (() => void) | undefined
    const waiting = new Promise<void>(resolve => {
      complete = resolve
    })
    const prepare = sinon.spy(async () => {
      await waiting
      return { key: 'data', data: 'new' }
    })
    await updateWellKnownEntry(cache, 'data', prepare)
    assert.equal(prepare.callCount, 0)
    const update = updateWellKnownEntry(cache, 'data', prepare, { force: true })
    assert.equal((await readWellKnownEntry(cache, 'data')).data, 'old')
    complete?.()
    await update
    assert.equal((await readWellKnownEntry(cache, 'data')).data, 'new')
  })

  it('leaves all datasets untouched if any preparation fails', async () => {
    const cache = makeCache()
    await publishWellKnownEntry(cache, { key: 'a', data: 'old-a' })
    await publishWellKnownEntry(cache, { key: 'b', data: 'old-b' })
    const set = sinon.spy(cache.stores[0], 'set')
    await assert.rejects(
      rebuildWellKnownEntries(cache, [
        async () => ({ key: 'a', data: 'new-a' }),
        async () => {
          throw new Error('Solr unavailable')
        },
      ]),
      /Solr unavailable/
    )
    assert.equal(set.callCount, 0)
    assert.equal((await readWellKnownEntry(cache, 'a')).data, 'old-a')
    assert.equal((await readWellKnownEntry(cache, 'b')).data, 'old-b')
  })

  it('waits for all preparations before publishing any dataset', async () => {
    const cache = makeCache()
    await publishWellKnownEntry(cache, { key: 'a', data: 'old' })
    let complete: (() => void) | undefined
    const waiting = new Promise<void>(resolve => {
      complete = resolve
    })
    const rebuild = rebuildWellKnownEntries(cache, [
      async () => ({ key: 'a', data: 'new' }),
      async () => {
        await waiting
        return { key: 'b', data: 'new-b' }
      },
    ])
    assert.equal((await readWellKnownEntry(cache, 'a')).data, 'old')
    assert.equal((await readWellKnownEntry(cache, 'b')).data, undefined)
    complete?.()
    await rebuild
    assert.equal((await readWellKnownEntry(cache, 'a')).data, 'new')
    assert.equal((await readWellKnownEntry(cache, 'b')).data, 'new-b')
  })

  it('preserves the previous record and local snapshot when the backing store rejects a write', async () => {
    const store = new Keyv({ throwOnErrors: true })
    const cache = createCache({ stores: [store] })
    await publishWellKnownEntry(cache, { key: 'data', data: '1' })
    const before = await readWellKnownEntry(cache, 'data')
    const load = createSnapshotLoader(cache, 'data', 'meta', raw => Number(raw))
    assert.equal(await load(), 1)
    sinon.stub(store, 'set').rejects(new Error('write failed'))
    await assert.rejects(publishWellKnownEntry(cache, { key: 'data', data: '2' }), /write failed/)
    assert.deepEqual(await readWellKnownEntry(cache, 'data'), before)
    assert.equal(await load(), 1)
  })

  it('does not let an in-flight old load replace a locally published snapshot', async () => {
    const cache = makeCache()
    await publishWellKnownEntry(cache, { key: 'data', data: '1' })
    const old = await cache.get(publishedEntryKey('data'))
    let complete: (() => void) | undefined
    const waiting = new Promise<void>(resolve => {
      complete = resolve
    })
    const get = sinon.stub(cache, 'get').callThrough()
    get
      .withArgs(publishedEntryKey('data'))
      .onFirstCall()
      .returns(waiting.then(() => old))
    const load = createSnapshotLoader(cache, 'data', 'meta', raw => Number(raw))
    const previous = load()
    await publishWellKnownEntry(cache, { key: 'data', data: '2' })
    assert.equal(await load(), 2)
    complete?.()
    assert.equal(await previous, 1)
    assert.equal(await load(), 2)
  })

  it('reports a false write result without invalidating the previous snapshot', async () => {
    const cache = makeCache()
    await publishWellKnownEntry(cache, { key: 'data', data: '1' })
    const load = createSnapshotLoader(cache, 'data', 'meta', raw => Number(raw))
    assert.equal(await load(), 1)
    sinon.stub(cache.stores[0], 'set').resolves(false)
    await assert.rejects(publishWellKnownEntry(cache, { key: 'data', data: '2' }), /Failed to publish/)
    assert.equal((await readWellKnownEntry(cache, 'data')).data, '1')
    assert.equal(await load(), 1)
  })
})
