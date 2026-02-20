import assert from 'node:assert'
import {
  CsvExportService,
  mapContentItemTypesToCsvRows,
  mapDataProvidersToCsvRows,
  mapMediaSourcesToCsvRows,
  serializeCsvRows,
} from '@/services/csv-exports/csv-exports.class.js'

describe('csv-exports service helpers', () => {
  it('serializes rows with id,label header and comma delimiter', () => {
    const result = serializeCsvRows([
      { id: 'source-1', label: 'Source One' },
      { id: 'source-2', label: 'Source Two' },
    ])

    const lines = result.trim().split(/\r?\n/)
    assert.strictEqual(lines[0], 'id,label')
    assert.strictEqual(lines[1], 'source-1,Source One')
    assert.strictEqual(lines[2], 'source-2,Source Two')
    assert.ok(!result.includes(';'))
  })

  it('escapes labels that include commas, quotes and newlines', () => {
    const result = serializeCsvRows([{ id: 'source-1', label: 'One, "Two"\nThree' }])

    assert.ok(result.includes('id,label'))
    assert.ok(result.includes('source-1,"One, ""Two""'))
    assert.ok(result.includes('Three"'))
  })

  it('maps data providers to id,label rows', () => {
    const result = mapDataProvidersToCsvRows([
      { id: 'BNF', name: 'National Library of France' },
      { id: 'SNL', name: 'Swiss National Library' },
    ])

    assert.deepStrictEqual(result, [
      { id: 'BNF', label: 'National Library of France' },
      { id: 'SNL', label: 'Swiss National Library' },
    ])
  })

  it('maps media sources to id,label rows', () => {
    const result = mapMediaSourcesToCsvRows([
      { uid: 'ABC', name: 'Alpha Bulletin' },
      { uid: 'XYZ', name: 'Zeta Times' },
    ])

    assert.deepStrictEqual(result, [
      { id: 'ABC', label: 'Alpha Bulletin' },
      { id: 'XYZ', label: 'Zeta Times' },
    ])
  })

  it('maps static content item type expansions to id,label rows', () => {
    const result = mapContentItemTypesToCsvRows()

    assert.deepStrictEqual(result, [
      { id: 'ad', label: 'advertisement' },
      { id: 'ar', label: 'article' },
      { id: 'ob', label: 'obituary' },
      { id: 'tb', label: 'tables' },
      { id: 'section', label: 'section' },
      { id: 'uc', label: 'unclassified items' },
      { id: 'page', label: 'Page' },
      { id: 'death_notice', label: 'obituary (other)' },
      { id: 'weather', label: 'weather forecast' },
      { id: 'w', label: 'weather news (other)' },
      { id: 'picture', label: 'picture' },
      { id: 'ch', label: 'chronicle' },
      { id: 'rb', label: 'radio broadcast' },
      { id: 'rbe', label: 'radio broadcast episode' },
      { id: 'chapter', label: 'chapter' },
      { id: 'no-type', label: 'No type provided' },
    ])
  })

  it('CsvExportService.find returns serialized CSV from injected loader', async () => {
    let calls = 0
    const service = new CsvExportService(async () => {
      calls += 1
      return [{ id: 'provider-1', label: 'Provider One' }]
    })

    const result = await service.find()

    assert.strictEqual(calls, 1)
    assert.strictEqual(result, 'id,label\nprovider-1,Provider One\n')
  })
})
