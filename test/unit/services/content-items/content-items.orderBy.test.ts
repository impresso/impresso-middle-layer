import { strict as assert } from 'assert'
import type { HookContext } from '@feathersjs/feathers'
import contentItemsHooks from '@/services/content-items/content-items.hooks.js'

type BeforeHooks = { before: { find: Array<(context: HookContext) => Promise<void>> } }

const runValidation = async (query: Record<string, unknown>) => {
  const [validate] = (contentItemsHooks as unknown as BeforeHooks).before.find
  const context = { path: 'content-items', method: 'find', params: { query } } as unknown as HookContext
  await validate(context)
  return context.params.sanitized as Record<string, unknown>
}

describe('content-items order_by', () => {
  it('maps readingOrder to the reading_order_i Solr field', async () => {
    const sanitized = await runValidation({ order_by: 'readingOrder' })
    assert.equal(sanitized.order_by, 'reading_order_i asc')
  })

  it('maps -readingOrder to descending reading_order_i', async () => {
    const sanitized = await runValidation({ order_by: '-readingOrder' })
    assert.equal(sanitized.order_by, 'reading_order_i desc')
  })
})
