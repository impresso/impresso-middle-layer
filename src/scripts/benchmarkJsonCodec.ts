/** Run with: node --import tsx src/scripts/benchmarkJsonCodec.ts */
import { strict as assert } from 'node:assert'
import JSONBigInt from 'json-bigint'
import { safeParseJson, safeStringifyJson } from '@/util/jsonCodec.js'

const legacy = JSONBigInt({ useNativeBigInt: true })

const fixtures = [
  {
    name: 'Solr content page',
    value: {
      response: {
        numFound: 10000,
        docs: Array.from({ length: 20 }, (_, index) => ({
          id: `paper-1900-01-01-a-i${index}`,
          content_txt: 'Historical newspaper text with accents: été, über. '.repeat(150),
          score: 0.812345,
          rights_bm_explore_l: 9223372036854775807n,
          rights_bm_get_tr_l: 9223372036854775809n,
          rights_bm_get_img_l: 18446744073709551615n,
          entities: [{ id: 'Q42', label: 'Example' }],
        })),
      },
    },
  },
  {
    name: 'Solr facet buckets',
    value: {
      facets: {
        topics: { buckets: Array.from({ length: 1000 }, (_, index) => ({ val: `topic-${index}`, count: index + 1 })) },
      },
    },
  },
  {
    name: 'HTTP content page',
    value: {
      pagination: { total: 10000, limit: 20, offset: 0 },
      data: Array.from({ length: 20 }, (_, index) => ({
        id: `paper-${index}`,
        meta: { date: '1900-01-01', mediaTitle: 'Newspaper', partnerTitle: 'Library' },
        text: { title: 'Example title', content: 'Historical newspaper text. '.repeat(100) },
        access: { accessBitmaps: { explore: 'f/////////8=' } },
      })),
    },
  },
]

const measure = (operation: () => unknown): number => {
  for (let index = 0; index < 50; index++) operation()
  const samples = Array.from({ length: 5 }, () => {
    const start = process.cpuUsage()
    for (let index = 0; index < 200; index++) operation()
    const elapsed = process.cpuUsage(start)
    return (elapsed.user + elapsed.system) / 200
  }).sort((a, b) => a - b)
  return samples[2]
}

process.stdout.write(`Node ${process.version}; median CPU microseconds/op, 5 batches of 200 after warmup\n`)
for (const { name, value } of fixtures) {
  const json = legacy.stringify(value)
  assert.deepEqual(safeParseJson(json), legacy.parse(json))
  assert.equal(safeStringifyJson(value), json)
  for (const [operation, oldRun, newRun] of [
    ['parse', () => legacy.parse(json), () => safeParseJson(json)],
    ['stringify', () => legacy.stringify(value), () => safeStringifyJson(value)],
  ] satisfies [string, () => unknown, () => unknown][]) {
    const oldUs = measure(oldRun)
    const newUs = measure(newRun)
    process.stdout.write(
      JSON.stringify({
        name,
        bytes: Buffer.byteLength(json),
        operation,
        legacyUs: +oldUs.toFixed(1),
        nativeUs: +newUs.toFixed(1),
        speedup: +(oldUs / newUs).toFixed(2),
      }) + '\n'
    )
  }
}
