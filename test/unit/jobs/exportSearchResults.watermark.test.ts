import { strict as assert } from 'assert'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse } from 'csv-parse/sync'
import { appendItemsToCSV } from '@/jobs/searchResults/exportSearchResults.js'
import {
  csvIdsHashStream,
  createReceipt,
  finalizeCsvWithToken,
  checkExportReceipt,
} from '@/util/provenance.js'
import { config } from '../../helpers/provenance.js'

describe('export provenance pre-publish gate', () => {
  it('writes a rectangular CSV across batches and rejects every invalid receipt binding', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'export-provenance-'))
    try {
      const path = join(folder, 'export.csv')
      await appendItemsToCSV(path, ['id', 'text'], [{ id: 'a', text: 'first, row\nnewline' }], { provenance: true })
      await appendItemsToCSV(path, ['id', 'text'], [{ id: 'b', text: 'second' }], { provenance: true })
      const original = await readFile(path, 'utf8')
      const records: string[][] = parse(original)
      assert.deepEqual(records[0], ['id', 'text', 'impresso:provenance'])
      assert.ok(records.every(row => row.length === 3))
      await assert.rejects(checkExportReceipt(path, 'export', 'user', config))
      const digest = await csvIdsHashStream(path)
      const input = { kind: 'export', exportId: 'export', userRef: 'user', ...digest } as const
      for (const patch of [
        { exportId: 'foreign' },
        { userRef: 'foreign' },
        { idsCount: 3 },
      ]) {
        await finalizeCsvWithToken(path, createReceipt({ ...input, ...patch }, config))
        await assert.rejects(checkExportReceipt(path, 'export', 'user', config))
      }
      await finalizeCsvWithToken(path, createReceipt(input, config))
      assert.ok(await checkExportReceipt(path, 'export', 'user', config))
      const finalized = await readFile(path, 'utf8')
      await writeFile(path, finalized.replace('"b"', '"c"'))
      await assert.rejects(checkExportReceipt(path, 'export', 'user', config))
    } finally {
      await rm(folder, { recursive: true, force: true })
    }
  })
  it('leaves disabled exports without the provenance column', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'export-provenance-'))
    try {
      const path = join(folder, 'export.csv')
      await appendItemsToCSV(path, ['id'], [{ id: 'a' }])
      assert.equal(await readFile(path, 'utf8'), '"id"\n"a"\n')
    } finally {
      await rm(folder, { recursive: true, force: true })
    }
  })
})
