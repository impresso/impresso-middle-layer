import { strict as assert } from 'assert'
import type { Filter } from 'impresso-jscommons'
import { protobuf } from 'impresso-jscommons'
import { FilterSerializationService } from '@/services/filter-serialization/filter-serialization.class.js'

describe('FilterSerializationService', () => {
  it('serializes filters into a protobuf base64 string', async () => {
    const filters: Filter[] = [
      { type: 'newspaper', q: 'GDL' } as Filter,
      { type: 'daterange', q: '1900-01-01 TO 1900-12-31' } as Filter,
    ]
    const service = new FilterSerializationService()

    const result = await service.create({ filters })

    assert.equal(result.filters, protobuf.searchQuery.serialize({ filters }))
    assert.deepStrictEqual(protobuf.searchQuery.deserialize(result.filters).filters, filters)
  })
})
