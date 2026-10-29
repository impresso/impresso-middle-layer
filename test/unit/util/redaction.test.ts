import { RedactionPolicy, redactObject } from '@/util/redaction.js'
import { strict as assert } from 'assert'
import { safeParseJson, safeStringifyJson } from '@/util/jsonCodec.js'
import { AuthorizationBitmapsKey } from '@/models/authorization.js'
import { cloneForRedaction } from '@/util/cloneForRedaction.js'

interface TestDocument {
  title: string
  images: { url: string }[]
  secret?: string
}

const incorrectInputs = [null, [1, 2, 3], 1, 'string', false, undefined]

describe('redactObject', () => {
  it('redacts object successfully', () => {
    const policy = {
      name: 'test',
      items: [
        {
          jsonPath: '$.title',
          valueConverterName: 'redact',
        },
        {
          jsonPath: '$.images[*].url',
          valueConverterName: 'contextNotAllowedImage',
        },
        {
          jsonPath: '$.secret',
          valueConverterName: 'remove',
        },
      ],
    } satisfies RedactionPolicy

    const input = {
      title: 'This is a title',
      images: [{ url: 'https://example.com/image1.jpg' }],
      secret: 'This is a secret',
    } satisfies TestDocument

    const expectedOutput = {
      title: '[REDACTED]',
      images: [{ url: 'https://impresso-project.ch/assets/images/not-allowed.png' }],
      secret: undefined,
    } satisfies TestDocument

    const result = redactObject(input, policy)
    assert.deepEqual({ ...result, images: result.images.map(image => ({ ...image })) }, expectedOutput)
  })

  it('does not mutate input, even when redacting nested arrays and running repeatedly', () => {
    const input = {
      title: 'public',
      images: [{ url: 'secret', keep: { value: 1 } }],
    }
    Object.freeze(input.images[0].keep)
    Object.freeze(input.images[0])
    Object.freeze(input.images)
    Object.freeze(input)
    const policy: RedactionPolicy = {
      name: 'nested',
      items: [{ jsonPath: '$.images[*].url', valueConverterName: 'redact' }],
    }
    const first = redactObject(input, policy)
    first.images[0].keep.value = 2
    assert.equal(input.images[0].url, 'secret')
    assert.equal(input.images[0].keep.value, 1)
    assert.equal(redactObject(input, policy).images[0].keep.value, 1)
    assert.equal(first.images[0].url, '[REDACTED]')
  })

  it('normalizes values like the old JSON clone, including custom class serialization', () => {
    class Document {
      toJSON(key: string) {
        return { key, content: 'secret' }
      }
    }
    const sparse = Array(2)
    sparse[1] = undefined
    const input = {
      date: new Date('2024-01-01T00:00:00Z'),
      invalidDate: new Date(NaN),
      doc: new Document(),
      omit: undefined,
      fn: () => 'ignored',
      symbol: Symbol('ignored'),
      numbers: [NaN, Infinity, -Infinity, -0, 0n, 1n, 9007199254740993n, 9007199254740992, 1000000000000000100, 1e21],
      sparse,
      boxed: [new Number(2), new String('text'), new Boolean(false)],
      raw: JSON.rawJSON('9007199254740993'),
      [Symbol('internal')]: 'hidden',
    }
    assert.deepEqual(cloneForRedaction(input), safeParseJson(safeStringifyJson(input)))
    const policy: RedactionPolicy = {
      name: 'serialized class',
      items: [{ jsonPath: '$.doc.content', valueConverterName: 'redact' }],
    }
    const wire = JSON.parse(safeStringifyJson(redactObject(input, policy)))
    assert.equal(wire.doc.content, '[REDACTED]')
    assert.equal(input.doc.toJSON('doc').content, 'secret')
  })

  it('redacts the serialized class view and invokes getters and toJSON once', () => {
    let getters = 0
    let serializers = 0
    const input = {
      get doc() {
        getters++
        return {
          get toJSON() {
            serializers++
            return (key: string) => ({ key, content: 'secret' })
          },
        }
      },
    }
    const policy: RedactionPolicy = {
      name: 'class',
      items: [{ jsonPath: '$.doc.content', valueConverterName: 'redact' }],
    }
    assert.equal(safeStringifyJson(redactObject(input, policy)), '{"doc":{"key":"doc","content":"[REDACTED]"}}')
    assert.equal(getters, 1)
    assert.equal(serializers, 1)
  })

  it('keeps policy order, including overlapping wildcard paths and missing fields', () => {
    const input = { groups: [{ items: [{ content: 'secret' }] }] }
    const policy: RedactionPolicy = {
      name: 'ordered',
      items: [
        { jsonPath: '$.groups[*].items[*].content', valueConverterName: 'redact' },
        { jsonPath: '$.groups[*].items', valueConverterName: 'emptyArray' },
        { jsonPath: '$.groups[*].items[*].content', valueConverterName: 'remove' },
        { jsonPath: '$.missing.field', valueConverterName: 'redact' },
      ],
    }
    assert.equal(safeStringifyJson(redactObject(input, policy)), '{"groups":[{"items":[]}]}')
    assert.equal(input.groups[0].items[0].content, 'secret')
  })

  it('copies shared references independently and rejects cycles', () => {
    const shared = { content: 'secret' }
    const input = { visible: shared, restricted: shared }
    const policy: RedactionPolicy = {
      name: 'alias',
      items: [{ jsonPath: '$.restricted.content', valueConverterName: 'redact' }],
    }
    const result = redactObject(input, policy)
    assert.equal(result.visible.content, 'secret')
    assert.equal(result.restricted.content, '[REDACTED]')
    assert.equal(shared.content, 'secret')
    const circular: { self?: object } = {}
    circular.self = circular
    assert.throws(() => redactObject(circular, policy), TypeError)
  })

  it('preserves detached authorization metadata through multiple policies, without serializing it', () => {
    const input = { content: 'secret', [AuthorizationBitmapsKey]: { getTranscript: 2n } }
    const policy: RedactionPolicy = { name: 'blanket', items: [{ jsonPath: '$.unused', valueConverterName: 'remove' }] }
    const result = redactObject(redactObject(input, policy), policy)
    assert.deepEqual(result[AuthorizationBitmapsKey], {
      explore: undefined,
      getTranscript: 2n,
      getImages: undefined,
      getAudio: undefined,
    })
    assert.notEqual(result[AuthorizationBitmapsKey], input[AuthorizationBitmapsKey])
    assert.equal(safeStringifyJson(result), '{"content":"secret"}')
  })

  it('rejects forbidden keys that would survive JSON serialization, but omits undefined values', () => {
    const input = JSON.parse('{"nested":{"constructor":"secret"}}')
    const policy: RedactionPolicy = { name: 'empty', items: [] }
    assert.throws(() => redactObject(input, policy), SyntaxError)
    assert.equal(safeStringifyJson(redactObject({ constructor: undefined }, policy)), '{}')
  })

  incorrectInputs.forEach(input => {
    it(`fails to redact unknown type of input: ${input}`, () => {
      const policy = {
        name: 'test',
        items: [
          {
            jsonPath: '$.title',
            valueConverterName: 'redact',
          },
        ],
      } satisfies RedactionPolicy

      assert.throws(
        () => Reflect.apply(redactObject, undefined, [input, policy]),
        Error,
        'The provided object is not Redactable'
      )
    })
  })
})
