import app from '@/app'
import assert from 'assert'

/*
./node_modules/.bin/eslint \
test/services/pages-timelines.test.js \
src/services/pages-timelines \
src/models src/hooks \
--config .eslintrc.json --fix \
&& NODE_ENV=test DEBUG=impresso* mocha test/services/pages-timelines.test.js
*/

describe("'pages-timelines' service", function () {
  this.timeout(15000)

  let service

  before(() => {
    service = app.service('pages-timelines')
  })

  it('registered the service', () => {
    assert.ok(service, 'Registered the service')
  })

  it('timeline fn not found', async () => {
    await app
      .service('pages-timelines')
      .get('not-valid', {})
      .then(() => {
        assert.fail('not here')
      })
      .catch(err => {
        assert.equal(err.name, 'NotFound', 'should get a 404 NotFound error')
        assert.ok(err, 'should get an error')
      })
  })

  it.only('global pages timelines', async () => {
    const results = await app.service('pages-timelines').get('stats', {})
    console.log(results)
    assert.ok(results)
  })

  it('JDG pages timelines', async () => {
    const results = await app.service('pages-timelines').get('stats', {
      query: {
        newspaper_uid: 'GDL',
      },
    })
    console.log(results)
  })
})
