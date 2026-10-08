import { strict as assert } from 'assert'
import { feathers } from '@feathersjs/feathers'
import type { AppServices } from '@/types.js'
import type { Configuration } from '@/configuration.js'
import { mkdtemp, readFile, writeFile, rm, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import jwt from 'jsonwebtoken'
import { parse } from 'csv-parse/sync'
import {
  createReceipt,
  verifyReceipt,
  hashIds,
  idsHash,
  csvIdsHash,
  csvIdsHashStream,
  finalizeCsvWithToken,
  initializeProvenance,
} from '@/util/provenance.js'

import { config, receipt, keys } from '../../helpers/provenance.js'

describe('provenance receipts', () => {
  it('roundtrips minimal archival claims and retains historical keys', () => {
    const token = receipt()
    const verified = verifyReceipt(token, {
      ...config,
      activeKid: 'two',
      publicKeys: { one: keys.publicKey, two: keys.publicKey },
    })
    assert.ok(verified.valid)
    assert.equal(verified.claims.userRef, 'user')
    assert.equal(verified.claims.kind, 'export')
    assert.ok(!('exp' in verified.claims))
    const decoded = jwt.decode(token, { complete: true })
    assert.ok(decoded)
    assert.equal(decoded.header.kid, 'one')
  })
  it('rejects forged, tampered, and unknown-key tokens without claims', () => {
    const token = receipt()
    const variants = [
      jwt.sign({ userRef: 'user' }, 'secret', { algorithm: 'HS256', keyid: 'one' }),
      token.slice(0, -20) + 'tampered',
      token.replace(token.split('.')[1], Buffer.from('{}').toString('base64url')),
      jwt.sign({}, keys.privateKey, { algorithm: 'RS256', keyid: 'unknown' }),
    ]
    for (const variant of variants) {
      const result = verifyReceipt(variant, config)
      assert.equal(result.valid, false)
      assert.ok(!('claims' in result))
    }
  })
  it('rejects every invalid required claim and kind/identifier mismatch', () => {
    const base = jwt.decode(receipt())
    assert.ok(base && typeof base === 'object')
    for (const key of ['iat', 'jti', 'userRef', 'idsHash', 'idsCount', 'kind', 'exportId']) {
      const claims: Record<string, unknown> = { ...base }
      delete claims[key]
      const token = jwt.sign(claims, keys.privateKey, {
        algorithm: 'RS256',
        keyid: 'one',
        ...(key === 'iat' ? { noTimestamp: true } : {}),
      })
      assert.equal(verifyReceipt(token, config).valid, false, key)
    }
    for (const patch of [
      { jti: '' },
      { userRef: '' },
      { idsHash: 'A'.repeat(64) },
      { idsCount: -1 },
      { idsCount: 1.5 },
      { path: 'search' },
      { kind: 'api', path: 'search' },
      { iss: 'foreign' },
      { aud: 'api' },
      { exp: 9999999999 },
    ]) {
      const claims: Record<string, unknown> = { ...base, ...patch }
      assert.equal(
        verifyReceipt(jwt.sign(claims, keys.privateKey, { algorithm: 'RS256', keyid: 'one' }), config).valid,
        false
      )
    }
  })
  it('hashes exact UTF-8 order, duplicates, and empty input; invalid IDs fail', () => {
    assert.equal(idsHash([]), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
    assert.notEqual(idsHash(['a', 'b']), idsHash(['b', 'a']))
    assert.notEqual(idsHash(['a', 'a']), idsHash(['a']))
    assert.notEqual(idsHash([' é ']), idsHash(['é']))
    for (const id of ['', 'a\r', 'a\n', null, 1]) assert.throws(() => hashIds([id]))
  })
})

describe('streaming CSV provenance', () => {
  it('preserves quoted commas/newlines; finalization repeats safely and covers ordered IDs', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'provenance-'))
    try {
      const path = join(folder, 'items.csv')
      await writeFile(
        path,
        '"id","text","impresso:provenance"\n"a","quoted, text\nsecond line",""\n"b","quote ""inside""",""\n'
      )
      const digest = await csvIdsHashStream(path)
      assert.deepEqual(digest, hashIds(['a', 'b']))
      const token = receipt()
      await finalizeCsvWithToken(path, token)
      const first = await readFile(path, 'utf8')
      const rows = parse<Record<string, string>>(await readFile(path), { columns: true })
      assert.equal(rows[0].text, 'quoted, text\nsecond line')
      assert.equal(rows[1].text, 'quote "inside"')
      assert.equal(rows[1]['impresso:provenance'], '')
      assert.equal(rows[0]['impresso:provenance'], token)
      assert.deepEqual(rows.map(row => row.id), ['a', 'b'])
      await finalizeCsvWithToken(path, token)
      assert.equal(await readFile(path, 'utf8'), first)
    } finally {
      await rm(folder, { recursive: true, force: true })
    }
  })
  it('leaves the original untouched and cleans temporary output when parsing fails mid-rewrite', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'provenance-'))
    try {
      const path = join(folder, 'broken.csv')
      const original = 'id,impresso:provenance\na,\nb,"unterminated'
      await writeFile(path, original)
      await assert.rejects(finalizeCsvWithToken(path, receipt()))
      assert.equal(await readFile(path, 'utf8'), original)
      assert.deepEqual(await readdir(folder), ['broken.csv'])
    } finally {
      await rm(folder, { recursive: true, force: true })
    }
  })
  it('rejects missing/duplicate headers, ragged rows, invalid IDs, and empty files', async () => {
    for (const csv of [
      '',
      'text\na\n',
      'id,id\na,b\n',
      'id,text,text\na,x,x\n',
      'id,text\na\n',
      'id\n""\n',
      'id\n"a\nb"\n',
      'id\n"unterminated',
    ])
      await assert.rejects(csvIdsHash(csv), csv)
    assert.deepEqual(await csvIdsHash('id\n'), hashIds([]))
  })
})

describe('provenance startup configuration', () => {
  it('requires an explicit distinct authentication audience and valid registered signing key', () => {
    const app = feathers<AppServices, Configuration>()
    app.set('provenance', { ...config })
    assert.throws(() => initializeProvenance(app), /audience/)
    app.set('authentication', { secret: 'api-secret', jwtOptions: { audience: config.audience } })
    assert.throws(() => initializeProvenance(app), /audience/)
    app.set('authentication', { secret: 'api-secret', jwtOptions: { audience: 'api' } })
    assert.doesNotThrow(() => initializeProvenance(app))
    app.set('provenance', { ...config, privateKey: '' })
    assert.throws(() => initializeProvenance(app), /signing key/)
    app.set('provenance', { ...config, publicKeys: { one: 'invalid public key' } })
    assert.throws(() => initializeProvenance(app), /does not match/)
  })
  it('generates warning-backed ephemeral keys only in development when both key stores are empty', () => {
    const previous = process.env.NODE_ENV
    try {
      const app = feathers<AppServices, Configuration>()
      app.set('authentication', { secret: 'api-secret', jwtOptions: { audience: 'api' } })
      for (const environment of [undefined, 'development', 'api-development']) {
        if (environment === undefined) delete process.env.NODE_ENV
        else process.env.NODE_ENV = environment
        app.set('provenance', { ...config, privateKey: '', publicKeys: {} })
        initializeProvenance(app)
        assert.equal(app.get('provenance')?.activeKid, 'ephemeral')
        const token = createReceipt({ kind: 'api', path: 'search', userRef: 'user', ...hashIds([]) }, app)
        assert.equal(verifyReceipt(token, app).valid, true)
      }
      process.env.NODE_ENV = 'production'
      app.set('provenance', { ...config, privateKey: '', publicKeys: {} })
      assert.throws(() => initializeProvenance(app), /signing key/)
    } finally {
      if (previous === undefined) delete process.env.NODE_ENV
      else process.env.NODE_ENV = previous
    }
  })
})
