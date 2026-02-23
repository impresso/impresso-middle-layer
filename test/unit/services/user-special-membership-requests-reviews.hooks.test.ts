import { strict as assert } from 'assert'
// Hooks
import userSpecialMembershipRequestReviewsHooks from '@/services/user-special-membership-requests-reviews/user-special-membership-requests-reviews.hooks.js'

const mockReviewerUserA = {
  uid: `reviewer1`,
  id: 999,
  username: `local-reviewer1`,
  firstname: `Reviewer First`,
  lastname: `Reviewer Last`,
  email: `reviewer1@example.com`,
  password: 'test',
}

describe('UserSpecialMembershipRequestReviewsService - Hooks', () => {
  describe('validate - find hook', () => {
    let validateHook: any

    beforeEach(() => {
      // Get the validate and queryWithCommonParams hooks from the hooks definition
      validateHook = userSpecialMembershipRequestReviewsHooks.before.find[0]
    })

    it('should accept valid status values', async () => {
      const context = {
        params: { query: { status: ['pending'] }, user: { id: mockReviewerUserA.id } },
      } as any

      try {
        await validateHook(context)
        assert.ok(true, 'Valid status should not throw')
      } catch (error: any) {
        assert.fail(`Should not throw for valid status: ${error.message}`)
      }
    })

    it('should accept multiple valid status values', async () => {
      const context = {
        params: { query: { status: ['pending', 'approved', 'rejected'] }, user: { id: mockReviewerUserA.id } },
      } as any

      try {
        await validateHook(context)
        assert.ok(true, 'Multiple valid statuses should not throw')
      } catch (error: any) {
        assert.fail(`Should not throw for valid statuses: ${error.message}`)
      }
    })

    it('should reject invalid status values', async () => {
      const context = {
        params: { query: { status: ['invalid_status'] }, user: { id: mockReviewerUserA.id } },
      } as any

      try {
        await validateHook(context)
        assert.fail('Should have thrown BadRequest for invalid status')
      } catch (error: any) {
        assert.strictEqual(error.code, 400)
        assert.ok(error.data.status.code.includes('NotInArray'), 'Error should indicate invalid choice')
      }
    })

    it('should reject mix of valid and invalid status values', async () => {
      const context = {
        params: { query: { status: ['pending', 'invalid_status'] }, user: { id: mockReviewerUserA.id } },
      } as any

      try {
        await validateHook(context)
        assert.fail('Should have thrown BadRequest for mixed valid/invalid status')
      } catch (error: any) {
        assert.strictEqual(error.code, 400)
      }
    })

    it('should accept valid order_by values', async () => {
      const context = {
        params: { query: { order_by: ['-dateLastModified'] }, user: { id: mockReviewerUserA.id } },
      } as any

      try {
        await validateHook(context)
        assert.ok(true, 'Valid order_by should not throw')
      } catch (error: any) {
        assert.fail(`Should not throw for valid order_by: ${error.message}`)
      }
    })

    it('should transform order_by to Sequelize format', async () => {
      const context = {
        params: { query: { order_by: ['-dateLastModified'] }, user: { id: mockReviewerUserA.id } },
      } as any

      await validateHook(context)
      // After hook processing, check if order_by was transformed
      assert.strictEqual(
        context.params.query.order_by[0][0],
        'dateLastModified',
        'order_by field should be dateLastModified'
      )
      assert.strictEqual(context.params.query.order_by[0][1], 'DESC', 'order_by direction should be DESC')
    })

    it('should reject invalid order_by values', async () => {
      const context = {
        params: { query: { order_by: ['invalid_ordering'] }, user: { id: mockReviewerUserA.id } },
      } as any

      try {
        await validateHook(context)
        assert.fail('Should have thrown BadRequest for invalid order_by')
      } catch (error: any) {
        assert.strictEqual(error.code, 400)
      }
    })

    it('should allow status to be optional', async () => {
      const context = {
        params: { query: {}, user: { id: mockReviewerUserA.id } },
      } as any

      try {
        await validateHook(context)
        assert.ok(true, 'Missing optional status should not throw')
      } catch (error: any) {
        assert.fail(`Should not throw when status is omitted: ${error.message}`)
      }
    })
  })
})
