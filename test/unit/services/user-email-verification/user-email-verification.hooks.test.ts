import { strict as assert } from 'assert'
import userEmailVerificationHooks from '@/services/user-email-verification/user-email-verification.hooks.js'

describe('UserEmailVerificationService - verify token', () => {
  it('should fail as token is not provided', async () => {
    const context = {
      data: {},
    } as any

    try {
      await userEmailVerificationHooks.before.create[0](context)
      assert.fail('Should have thrown BadRequest for missing token')
    } catch (error: any) {
      assert.strictEqual(error.code, 400)
      assert.strictEqual(error.data.token.code, 'NotFound')
      assert.strictEqual(error.data.token.message, 'token required')
    }
  })

  it('should fail as token is not valid', async () => {
    const context = {
      data: {
        token: 'invalid token',
      },
    } as any

    try {
      await userEmailVerificationHooks.before.create[0](context)
      assert.fail('Should have thrown BadRequest for invalid token')
    } catch (error: any) {
      assert.strictEqual(error.code, 400)
      // data: {
      //   token: {
      //     code: 'NotValidRegex',
      //     regex: '/^[A-Za-z0-9_-]+$/',
      //     message: 'token param is not valid'
      //   }
      // }
      assert.strictEqual(error.data.token.code, 'NotValidRegex')
      assert.strictEqual(error.data.token.regex, '/^[A-Za-z0-9_-]+$/')
      assert.strictEqual(error.data.token.message, 'token param is not valid')
    }
  })

  it('should pass as token is valid', async () => {
    const context = {
      data: {
        token: 'valid_token-123',
      },
    } as any
    try {
      await userEmailVerificationHooks.before.create[0](context)
    } catch (error: any) {
      assert.fail('Should not have thrown BadRequest for valid token')
    }
  })
})
