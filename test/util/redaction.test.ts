import { RedactionPolicy, redactObject } from '../../src/util/redaction'
import assert from 'assert'

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

    assert.deepEqual(redactObject(input, policy), expectedOutput)
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

      assert.throws(() => redactObject(input as any, policy), Error, 'The provided object is not Redactable')
    })
  })
})
