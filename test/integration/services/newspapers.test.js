import assert from 'assert'
import app from '../../../src/app'
import Newspaper from '../../../src/models/newspapers.model'
/**
./node_modules/.bin/eslint  \
src/models src/services/newspapers src/hooks test/services/newspapers.test.js \
--config .eslintrc.json --fix \
&& NODE_ENV=test DEBUG=impresso*,verbose* mocha test/services/newspapers.test.js
*/
describe("'newspapers' service", function () {
  this.timeout(15000)

  let service

  before(() => {
    service = app.service('newspapers')
  })

  it('registered the service', async () => {
    assert.ok(service, 'Registered the service')
  })

  it('handle 404 not found', async () => {
    const result = await service.get('JDGRRRRRRRRR').catch(({ code }) => {
      assert.strictEqual(code, 404)
    })
    assert.strictEqual(result, undefined)
  })

  it('get single newspaper', async () => {
    const result = await service.get('JDG')
    assert.strictEqual(result.uid, 'JDG')
    assert.strictEqual(result.included, true)
  })

  it('get single newspaper existing, not yet included', async () => {
    const result = await service.get('DVF')
    assert.strictEqual(result.uid, 'DVF')
    assert.strictEqual(result.included, false)
  })

  it('get newspapers, should fail because of JSON schema', async () => {
    const result = await service
      .find({
        query: {
          included: true,
        },
      })
      .catch(({ code }) => {
        assert.strictEqual(code, 400)
      })
    assert.strictEqual(result, undefined)
  })

  it('get only included newspaper', async () => {
    const results = await service.find({
      query: {
        order_by: 'lastIssue',
        filters: [
          {
            type: 'included',
          },
        ],
      },
    })
    assert.ok(results.total > 0, 'has a total greater than zero')
    if (!results.cached) {
      assert.ok(results.data[0] instanceof Newspaper, 'is an instance of Newspaper')
    } else {
      assert.ok(results.data[0].acronym, 'is a valid newspaper')
    }
  })

  it('get newspapers, order by countIssues desc', async () => {
    const results = await service.find({
      query: {
        order_by: '-countIssues',
      },
    })
    assert.ok(results.data[0].countIssues > results.data[1].countIssues, 'the biggest newspaper first')
  })

  it('get newspapers!', async () => {
    const results = await service.find({
      query: {},
    })

    assert.ok(results.total > 0, 'has a total greater than zero')
    if (!results.cached) {
      assert.ok(results.data[0] instanceof Newspaper, 'is an instance of Newspaper')
    } else {
      assert.ok(results.data[0].acronym, 'is a valid newspaper')
    }
  })

  it('get newspapers containing "gazette", ordered by start year!', async () => {
    const results = await service.find({
      query: {
        q: 'gazette',
        order_by: 'startYear',
      },
    })
    assert.ok(results.total > 0, 'has a total greater than zero')
    if (!results.cached) {
      assert.ok(results.data[0] instanceof Newspaper, 'is an instance of Newspaper')
    } else {
      assert.ok(results.data[0].acronym, 'is a valid newspaper')
    }
  })
})
