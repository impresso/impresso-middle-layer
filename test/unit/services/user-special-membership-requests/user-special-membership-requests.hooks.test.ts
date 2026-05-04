import { strict as assert } from 'assert'
import userSpecialMembershipRequestsHooks from '@/services/user-special-membership-requests/user-special-membership-requests.hooks.js'

describe('UserSpecialMembershipRequestsService - Hooks', () => {
  describe('validate - create hook', () => {
    let validateCreateHook: any

    beforeEach(() => {
      validateCreateHook = userSpecialMembershipRequestsHooks.before.create[0]
    })

    it('should accept valid create payload and coerce fields', async () => {
      const context = {
        data: {
          specialMembershipAccessId: '2',
          notes: '  Please approve this temporary access.  ',
          isTemporary: 'true',
        },
      } as any

      await validateCreateHook(context)

      assert.strictEqual(context.data.specialMembershipAccessId, 2)
      assert.strictEqual(context.data.notes, 'Please approve this temporary access.')
      assert.strictEqual(context.data.isTemporary, true)
    })

    it('should reject invalid isTemporary values', async () => {
      const context = {
        data: {
          specialMembershipAccessId: 2,
          notes: 'Valid note',
          isTemporary: 'yes',
        },
      } as any

      await assert.rejects(
        async () => validateCreateHook(context),
        (error: any) => {
          assert.strictEqual(error.code, 400)
          assert.ok(error.data.isTemporary.code.includes('NotValidCustomFunction'))
          return true
        }
      )
    })

    it('should reject notes longer than 1000 chars', async () => {
      const context = {
        data: {
          specialMembershipAccessId: 2,
          notes: 'a'.repeat(1001),
          isTemporary: false,
        },
      } as any

      await assert.rejects(
        async () => validateCreateHook(context),
        (error: any) => {
          assert.strictEqual(error.code, 400)
          assert.ok(error.data.notes.code.includes('NotValidLength'))
          return true
        }
      )
    })
  })
})
