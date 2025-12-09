import assert from 'assert'
import app from '../../../src/app'

/*
./node_modules/.bin/eslint  \
src/services/mentions \
src/models/entity-mentions.model.js \
test/services/mentions.test.js \
src/hooks/sequelize.js \
src/hooks/resolvers/mentions.resolvers.js \
--config .eslintrc.json --fix \
&& NODE_ENV=development DEBUG=verbose*,imp*,@feathersjs/error* mocha test/services/mentions.test.js
*/
describe("'mentions' service", function () {
  this.timeout(30000)

  let service

  before(() => {
    service = app.service('mentions')
  })

  it('registered the service', () => {
    assert.ok(service, 'Registered the service')
  })

  it('find mentions for Leipzig', async () => {
    const result = await service
      .find({
        query: {
          order_by: 'id',
          filters: [
            {
              type: 'entity',
              q: 'aida-0001-54-Leipzig',
            },
          ],
        },
      })
      .catch(err => {
        console.log(err)
      })
    assert.ok(result.total, 'there are results')
    assert.ok(result.data[0].entityId, 'aida-0001-54-Leipzig')
    assert.ok(result.data[0].type, 'location')
    assert.ok(result.data[0].articleUid, 'there should be an article attached')
    assert.ok(result.data[0].article.uid, 'there is an article attached')
  })

  it('find mentions for a person', async () => {
    const result = await service
      .find({
        query: {
          order_by: 'name',
          filters: [
            {
              type: 'entity',
              q: 'aida-0001-50-"Arizona"_Charlie_Meadows',
            },
          ],
        },
      })
      .catch(err => {
        console.log(err)
      })
    assert.ok(result.total, 'there are results')
    assert.ok(result.data[0].type, 'person')
    assert.ok(result.data[0].ancillary)
    assert.ok(result.data[0].articleUid, 'there should be an article attached')
    if (result.data[0].article) {
      assert.ok(result.data[0].article.uid, 'there is an article attached')
    }
  })
})
