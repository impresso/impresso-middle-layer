import { strict as assert } from 'assert'
import meServiceHooks from '@/services/me/me.hooks.js'

describe('MeService - update Hooks', () => {
  let validateWithSchema: any
  beforeEach(() => {
    // Get the validate and queryWithCommonParams hooks from the hooks definition
    validateWithSchema = meServiceHooks.before.update[0]
  })
  it('should fail as update expect many fields, see json schema:"required": ["firstname", "lastname", "email"],', async () => {
    const context = {
      data: {
        institutionalUrl: 'https://www.example.com',
      },
    } as any

    try {
      await validateWithSchema(context)
    } catch (error: any) {
      assert.strictEqual(error.code, 400)

      /*
      error.data [
        [ 'firstname', 'missing required property' ],
        [ 'lastname', 'missing required property' ],
        [ 'email', 'missing required property' ]
      ]*/
      assert.ok(
        error.data.some((e: any) => e[0] === 'firstname'),
        'Error should indicate missing firstname'
      )
      assert.ok(
        error.data.some((e: any) => e[0] === 'lastname'),
        'Error should indicate missing lastname'
      )
      assert.ok(
        error.data.some((e: any) => e[0] === 'email'),
        'Error should indicate missing email'
      )
    }
  })
  it('should fail as URL is not compliant with the regex pattern', async () => {
    const context = {
      data: {
        firstname: 'John',
        lastname: 'Doe',
        email: 'john.doe@uni.edu',
        institutionalUrl: 'https:/s',
      },
    } as any

    try {
      await validateWithSchema(context)
      assert.fail('Should have thrown BadRequest for invalid URL pattern')
    } catch (error: any) {
      assert.strictEqual(error.code, 400)
      /**
       * [
  [
    'institutionalUrl',
    "does not match pattern: ^(https?://)?([\\w\\-]+\\.)+[\\w\\-]+(/[\\w\\-._~:/?#[\\]@!$&'()*+,;=]*)?$"
  ]
]
       */
      assert.ok(
        error.data.some((e: any) => e[0] === 'institutionalUrl'),
        'Error should indicate invalid institutionalUrl pattern'
      )
    }
  })

  it('should pass with valid institutionalUrl', async () => {
    const contexts = ['https://www.uni.lu/c2dh-en/people/daniele-guido/'].map(
      url =>
        ({
          data: {
            firstname: 'John',
            lastname: 'Doe',
            email: 'john.doe@uni.edu',
            institutionalUrl: url,
          },
        }) as any
    )

    for (const context of contexts) {
      try {
        await validateWithSchema(context)
        assert.ok(true, `Valid institutionalUrl should not throw: ${context.data.institutionalUrl}`)
      } catch (error: any) {
        assert.fail(
          `Should not throw for valid institutionalUrl: ${context.data.institutionalUrl}, error: ${error.message}`
        )
      }
    }
  })
})
