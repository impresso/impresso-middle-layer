import { strict as assert } from 'assert'
import hooks from '@/services/user-email-verification-resend/user-email-verification-resend.hooks.js'

describe('UserEmailVerificationResend hooks', () => {
  it('fails when email is missing', async () => {
    const context = {
      data: {},
    } as any

    try {
      await hooks.before.create[0](context)
      assert.fail('Expected BadRequest for missing email')
    } catch (error: any) {
      assert.strictEqual(error.code, 400)
      assert.strictEqual(error.data.email.code, 'NotFound')
      assert.strictEqual(error.data.email.message, 'email required')
    }
  })

  it('fails when email is invalid', async () => {
    const context = {
      data: {
        email: 'not-an-email',
      },
    } as any

    try {
      await hooks.before.create[0](context)
      assert.fail('Expected BadRequest for invalid email')
    } catch (error: any) {
      assert.strictEqual(error.code, 400)
      assert.strictEqual(error.data.email.code, 'NotValidRegex')
    }
  })

  it('passes when email is valid', async () => {
    const context = {
      data: {
        email: 'valid@example.org',
      },
    } as any

    await hooks.before.create[0](context)
    assert.strictEqual(context.data.sanitized.email, 'valid@example.org')
  })
})
