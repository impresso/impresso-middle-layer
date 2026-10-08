import { strict as assert } from 'assert'
import { feathers } from '@feathersjs/feathers'
import type { AppServices } from '@/types.js'
import type { Configuration } from '@/configuration.js'
import { ProvenanceService } from '@/services/provenance/provenance.class.js'
import { hashIds } from '@/util/provenance.js'
import { config, receipt } from '../../../helpers/provenance.js'

describe('provenance verification service', () => {
  const app = feathers<AppServices, Configuration>()
  app.set('provenance', config)
  const service = new ProvenanceService(app)
  it('verifies receipts with optional ID material and examines both hash and count', async () => {
    const token = receipt()
    const signatureOnly = await service.create({ token })
    assert.ok(signatureOnly.valid)
    assert.ok(!('idsMatch' in signatureOnly))
    for (const ids of [['a', 'b'], ['a'], ['b', 'a'], ['a', 'b', 'c'], ['a', 'a', 'b']]) {
      const expected = ids.join() === 'a,b'
      assert.deepEqual(await service.create({ token, ids }), { ...signatureOnly, idsMatch: expected })
    }
    assert.deepEqual(await service.create({ token, ...hashIds(['a', 'b']) }), {
      ...signatureOnly,
      idsMatch: true,
    })
    for (const ids of [['a', 'b'], ['a']]) {
      assert.deepEqual(
        await service.create({
          token,
          csv: 'id,impresso:provenance\n' + ids.map(id => `${id},foreign-token`).join('\n'),
        }),
        { ...signatureOnly, idsMatch: ids.length === 2 }
      )
    }
    assert.deepEqual(await service.create({ token, idsHash: hashIds(['a', 'b']).idsHash, idsCount: 3 }), {
      ...signatureOnly,
      idsMatch: false,
    })
  })
  it('returns no claims for invalid receipts and rejects malformed contracts with 422', async () => {
    assert.deepEqual(Object.keys(await service.create({ token: 'invalid' })).sort(), ['reason', 'valid'])
    for (const data of [
      null,
      {},
      { token: 123 },
      { token: '' },
      { token: receipt(), extra: true },
      { token: receipt(), ids: [1] },
      { token: receipt(), ids: [], csv: 'id\n' },
      { token: receipt(), idsHash: 'a'.repeat(64) },
      { token: receipt(), idsHash: 'A'.repeat(64), idsCount: 2 },
      { token: receipt(), idsHash: 'a'.repeat(64), idsCount: Number.MAX_SAFE_INTEGER + 1 },
      { token: receipt(), idsCount: 2 },
      { token: receipt(), csv: 'id\n"broken' },
      { token: 'x'.repeat(16385) },
      { token: '😀'.repeat(8193) },
      { token: receipt(), ids: ['a'.repeat(4097)] },
      { token: receipt(), ids: ['😀'.repeat(2049)] },
      { token: receipt(), ids: Array(100001).fill('a') },
      { token: receipt(), csv: 'x'.repeat(1048577) },
      { token: receipt(), csv: 'id\n' + 'é'.repeat(524288) },
    ]) {
      await assert.rejects(
        // External payloads can violate the TypeScript contract; exercise runtime validation.
        Reflect.apply(service.create, service, [data]),
        error => error instanceof Error && 'code' in error && error.code === 422
      )
    }
  })
})
