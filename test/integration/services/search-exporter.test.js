import assert from 'assert'
import stringify from 'csv-stringify-as-promised'
import fs from 'fs'
import app from '../../../src/app'

/**
 * use with
  ./node_modules/.bin/eslint test/services/search-exporter.test.js  \
  src/services/search-exporter src/hooks --fix \
  && DEBUG=impresso/* mocha test/services/search-exporter.test.js
 */
describe("'search-exporter' service", function () {
  this.timeout(20000)

  let service

  before(() => {
    service = app.service('search-exporter')
  })

  it('registered the service', () => {
    assert.ok(service, 'Registered the service')
  })

  it('given a search, return the metadata', async () => {
    const offset = 0
    const limit = 500
    const results = await service
      .find({
        user: {
          is_staff: true,
        },
        query: {
          format: 'csv',
          group_by: 'articles',
          offset,
          filters: [
            {
              type: 'string',
              context: 'include',
              q: 'paneurop*',
            },
            {
              type: 'daterange',
              context: 'include',
              daterange: '1900-01-01T00:00:00Z TO 1945-01-01T00:00:00Z',
            },
          ],
          // filters: [
          //   {
          //     type: 'string',
          //     context: 'include',
          //     q: 'europ* OR Osteurop*',
          //   },
          //   {
          //     type: 'daterange',
          //     context: 'include',
          //     daterange: '1939-01-09T00:00:00Z TO 1945-05-08T00:00:00Z',
          //   },
          // ],
        },
      })
      .catch(err => {
        assert.fail(err)
      })

    const csv = await stringify(results.records, {
      delimiter: ';',
      header: true,
    })

    fs.writeFileSync(`./results-${offset}-${limit}.csv`, csv)

    // limit should be the default one, even if the user has set 30000
    // console.log(csv);
    assert.ok(results, 'returned CSV')
  })
})
