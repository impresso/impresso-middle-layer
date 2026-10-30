/** Run with: npm run benchmark:redaction */
import { strict as assert } from 'node:assert'
import { JSONPath } from 'jsonpath-plus'
import { cloneForRedaction } from '@/util/cloneForRedaction.js'
import { DefaultConverters, redactObject, type RedactionPolicy } from '@/util/redaction.js'
import { safeParseJson, safeStringifyJson } from '@/util/jsonCodec.js'

const policy: RedactionPolicy = {
  name: 'content item',
  items: [
    { jsonPath: '$.image.pages[*].regionCoordinates', valueConverterName: 'remove' },
    { jsonPath: '$.image.lineBreaks', valueConverterName: 'remove' },
    { jsonPath: '$.access.accessBitmaps', valueConverterName: 'remove' },
    { jsonPath: '$.text.content', valueConverterName: 'redact' },
    { jsonPath: '$.image.pages[*].iiif.thumbnailUrl', valueConverterName: 'contextNotAllowedImage' },
  ],
}

const makeItem = (repetitions: number) => ({
  id: 'paper-1900-01-01-a-i0001',
  meta: { date: '1900-01-01', mediaTitle: 'Newspaper' },
  text: { title: 'Public title', content: 'Historical newspaper text: été, über. '.repeat(repetitions) },
  access: { accessBitmaps: { explore: '//////////8=', getTranscript: 'AAAAAAAAAAI=' } },
  image: {
    lineBreaks: Array.from({ length: 100 }, (_, index) => index * 20),
    pages: Array.from({ length: 3 }, () => ({
      regionCoordinates: Array.from({ length: 20 }, (_, index) => ({ x: index, y: index, w: 20, h: 30 })),
      iiif: { thumbnailUrl: 'https://example.com/image/full/200,/0/default.jpg' },
    })),
  },
  topics: Array.from({ length: 10 }, (_, index) => ({
    id: `topic-${index}`,
    words: ['history', 'news'],
    relevance: 0.5,
  })),
})

const roundTripClone = (value: unknown) => safeParseJson(safeStringifyJson(value))
const oldRedact = (value: unknown, clone: (input: unknown) => unknown) => {
  const copy = clone(value)
  if (copy === null || typeof copy !== 'object') throw new Error('Expected an object')
  for (const item of policy.items) {
    JSONPath({
      path: item.jsonPath,
      json: copy,
      callback: (match, _type, payload) => {
        payload.parent[payload.parentProperty] = DefaultConverters[item.valueConverterName](match)
      },
    })
  }
  return copy
}

const measure = (operation: () => unknown): number => {
  for (let index = 0; index < 30; index++) operation()
  const samples = Array.from({ length: 5 }, () => {
    const start = process.cpuUsage()
    for (let index = 0; index < 200; index++) operation()
    const elapsed = process.cpuUsage(start)
    return (elapsed.user + elapsed.system) / 200
  }).sort((a, b) => a - b)
  return samples[2]
}

process.stdout.write(`Node ${process.version}; median CPU microseconds/op, 5 batches of 200 after warmup\n`)
for (const [name, input] of [
  ['short item', makeItem(200)],
  ['long transcript', makeItem(5000)],
] satisfies [string, ReturnType<typeof makeItem>][]) {
  const expected = safeStringifyJson(oldRedact(input, roundTripClone))
  assert.equal(safeStringifyJson(redactObject(input, policy)), expected)
  assert.equal(safeStringifyJson(oldRedact(input, structuredClone)), expected)
  for (const [operation, oldRun, structuredRun, newRun] of [
    ['clone', () => roundTripClone(input), () => structuredClone(input), () => cloneForRedaction(input)],
    [
      'redact',
      () => oldRedact(input, roundTripClone),
      () => oldRedact(input, structuredClone),
      () => redactObject(input, policy),
    ],
  ] satisfies [string, () => unknown, () => unknown, () => unknown][]) {
    const oldUs = measure(oldRun)
    const structuredUs = measure(structuredRun)
    const newUs = measure(newRun)
    process.stdout.write(
      JSON.stringify({
        name,
        operation,
        oldUs: +oldUs.toFixed(1),
        structuredUs: +structuredUs.toFixed(1),
        newUs: +newUs.toFixed(1),
        speedup: +(oldUs / newUs).toFixed(2),
      }) + '\n'
    )
  }
}
