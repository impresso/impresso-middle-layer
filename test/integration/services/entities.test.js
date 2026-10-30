import { strict as assert } from 'assert'
import app from '@/app.js'

describe("'entities' service (v3 index)", function () {
  this.timeout(10000)

  it('is registered', () => {
    assert.ok(app.service('entities'))
  })

  it('finds entities by label and primary type', async () => {
    const result = await app.service('entities').find({
      query: { q: 'Berlin', filters: [{ type: 'type', q: 'location' }] },
    })
    assert.ok(result.total)
    assert.equal(result.data[0].type, 'location')
    assert.match(result.data[0].id, /^Q[0-9]+$/)
  })

  it('gets a QID with Wikidata details', async () => {
    const entity = await app.service('entities').get('Q64')
    assert.equal(entity.id, 'Q64')
    assert.equal(entity.wikidataId, 'Q64')
    assert.equal(entity.type, 'location')
    assert.ok(entity.name)
    assert.ok(entity.wikidata)
  })
})
