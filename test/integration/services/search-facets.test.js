import assert from 'assert'
import app from '@/app'

/*
./node_modules/.bin/eslint  \
src/services/search-facets \
src/services/search/search.validators.js \
test/services/search-facets.test.js \
--config .eslintrc.json --fix \
&& NODE_ENV=development DEBUG=verbose*,imp* mocha test/services/search-facets.test.js
*/
describe("'search-facets' service", () => {
  let service

  before(() => {
    service = app.service('search-facets')
  })

  it('registered the service', () => {
    assert.ok(service, 'Registered the service')
  })

  it('registered the service', async () => {
    const results = await service.find({
      query: {
        group_by: 'articles',
        facets: ['person'],
      },
    })
    console.log(results)
  })
})
