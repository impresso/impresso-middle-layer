import { strict as assert } from 'assert'
import { paramsValidator } from '@/services/search/search.validators.js'

describe('search validators: order_by', () => {
  it('accepts readingOrder and -readingOrder', () => {
    assert.ok(paramsValidator.order_by.choices.includes('readingOrder'))
    assert.ok(paramsValidator.order_by.choices.includes('-readingOrder'))
  })

  it('maps readingOrder to ascending reading_order_i', () => {
    assert.equal(paramsValidator.order_by.transform('readingOrder'), 'reading_order_i asc')
  })

  it('maps -readingOrder to descending reading_order_i', () => {
    assert.equal(paramsValidator.order_by.transform('-readingOrder'), 'reading_order_i desc')
  })
})
