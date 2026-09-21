import { strict as assert } from 'assert'
import collectionsHooks from '@/services/collections/collections.hooks.js'

describe('CollectionsService - Hooks', () => {
  describe('validate - find hook', () => {
    let validateHook: any

    beforeEach(() => {
      validateHook = (collectionsHooks as any).before.find[0]
    })

    it('accepts valid order_by values', async () => {
      const context = {
        params: { query: { order_by: ['-date'] } },
      } as any

      validateHook(context)
      assert.strictEqual(context.params.query.order_by, '-date')
    })

    it('accepts ascending order_by values', async () => {
      const context = {
        params: { query: { order_by: ['date'] } },
      } as any

      validateHook(context)
      assert.strictEqual(context.params.query.order_by, 'date')
    })

    it('accepts creationDate order_by values', async () => {
      const context = {
        params: { query: { order_by: ['creationDate'] } },
      } as any

      validateHook(context)
      assert.strictEqual(context.params.query.order_by, 'creationDate')
    })

    it('accepts valid term values', async () => {
      const context = {
        params: { query: { term: 'archive' } },
      } as any

      validateHook(context)
      assert.strictEqual(context.params.query.term, 'archive')
    })

    it('rejects overly long term values', async () => {
      const context = {
        params: { query: { term: 'x'.repeat(201) } },
      } as any

      await assert.rejects(validateHook(context), (error: any) => {
        assert.strictEqual(error.code, 400)
        return true
      })
    })

    it('rejects unsupported order_by values', async () => {
      const context = {
        params: { query: { order_by: ['size'] } },
      } as any

      await assert.rejects(validateHook(context), (error: any) => {
        assert.strictEqual(error.code, 400)
        return true
      })
    })
  })
})
