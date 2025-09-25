import assert from 'assert'
import app from '../../../src/app'

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
/*
./node_modules/.bin/eslint  \
src/services/search src/hooks \
--config .eslintrc.json --fix \
&& NODE_ENV=development DEBUG=impresso* mocha test/services/search.create.test.js

*/
describe("'search' service, 'create' method", function () {
  this.timeout(20000)

  let service

  before(() => {
    service = app.service('search')
  })

  it('throw an error bad request', async () => {
    await service
      .create(
        {
          collection_uid: 'local-abc',
        },
        {
          query: {
            group_by: 'articles',
          },
        }
      )
      .catch(err => {
        assert.equal(err.name, 'BadRequest', 'should be 400 Bad Request')
        assert.equal(err.data.filters.code, 'NotFound', 'filters should be compulsory')
      })
  })

  it('save a search', async () => {
    await sleep(2000)
    const result = await service.create(
      {},
      {
        user: {
          id: 12,
        },
        query: {
          collection_uid: 'local-abc',
          group_by: 'articles',
          filters: [
            {
              type: 'string',
              context: 'include',
              q: 'europ*',
            },
            {
              type: 'daterange',
              context: 'include',
              daterange: '1900-01-01T00:00:00Z TO 1945-01-01T00:00:00Z',
            },
          ],
        },
      }
    )
    console.log('save a search', result)
    assert.ok(result, 'should not throw any exception')
  })
})
