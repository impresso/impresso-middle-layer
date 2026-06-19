import { strict as assert } from 'assert'
import type { Filter } from 'impresso-jscommons'
import hooks from '@/services/filter-serialization/filter-serialization.hooks.js'

describe('FilterSerialization hooks', () => {
  it('validates the create request body', () => {
    const validateHook = hooks.before.create[1]
    const context = {
      data: {
        filters: [{ type: 'newspaper', q: 'GDL' } as Filter],
      },
    } as any

    const result = validateHook(context)

    assert.equal(result, context)
  })

  it('rejects create request body without filters', () => {
    const validateHook = hooks.before.create[1]
    const context = {
      data: {},
    } as any

    assert.throws(() => validateHook(context), /must have required property 'filters'/)
  })
})
