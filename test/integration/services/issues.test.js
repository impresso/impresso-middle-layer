const assert = require('assert')
const app = require('../../../src/app')

/**
 * use with
 ./node_modules/.bin/eslint \
 src/models/issues.model.js \
 test/services/issues.test.js  \
 src/services/issues \
 --config .eslintrc.json --fix \
 && NODE_ENV=development DEBUG=impresso/* mocha test/services/issues.test.js
 */
describe("'issues' service", function () {
  this.timeout(25000)

  let service

  before(() => {
    service = app.service('issues')
  })

  it('registered the service', () => {
    assert.ok(service, 'Registered the service')
  })

  it('it should load issues, sort by -date', async () => {
    const results = await service.find({
      query: {
        order_by: ['date', '-name'],
      },
    })
    assert.ok(results.total > 0, 'find at least one issue :)')
    assert.ok(results.data[0].iiif, 'has iiif url based on cover')

    // cannot test if is instanceOf Issue here, since we have after hooks
    // who transform data.
    assert.ok(results.total > 0, 'find at least one issue :)')
  })

  it('it should load issues from GDL only, sort by -date', async () => {
    const results = await service.find({
      query: {
        order_by: ['date'],
        filters: [
          {
            type: 'newspaper',
            context: 'include',
            q: 'GDL',
          },
        ],
      },
    })
    assert.ok(results.total > 0, 'find at least one issue :)')
    assert.ok(results.data[0].iiif, 'has iiif url based on cover')
    // cannot test if is instanceOf Issue here, since we have after hooks
    // who transform data.
    assert.ok(results.total > 0, 'find at least one issue :)')
  })

  it('it should load a single issue', async () => {
    const result = await service.get('GDL-1811-11-22-a', {}).catch(err => {
      console.log(err)
    })
    assert.ok(result)
    assert.equal(result.uid, 'GDL-1811-11-22-a')
  })
})
