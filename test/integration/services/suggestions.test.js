const assert = require('assert')
const app = require('../../../src/app')
const { toPlainText } = require('../../../src/helpers')
/*

 ./node_modules/.bin/eslint \
 test/services/suggestions.test.js  \
 src/services/suggestions \
 --config .eslintrc.json --fix &&
 NODE_ENV=development mocha test/services/suggestions.test.js

*/

describe("'suggestions' service", function () {
  this.timeout(10000)
  let service

  before(() => {
    service = app.service('suggestions')
  })

  it('registered the service', () => {
    assert.ok(service, 'Registered the service')
  })

  it('test getTopics sub service', async () => {
    const results = await service.suggestTopics({
      q: 'suiss',
    })
    assert.strictEqual(results[0].type, 'topic')
  })

  it('test getMentions sub service', async () => {
    const results = await service.suggestMentions({
      q: 'Rome',
    })
    assert.strictEqual(results[0].type, 'mention')
    assert.strictEqual(results[0].item.type, 'location', 'correct mention type in mention item')
    assert.strictEqual(results[0].q, 'Rome')
    assert.strictEqual(results[0].item.name, 'Rome')
  })

  it('test getMentions sub service with partial regex', async () => {
    const results = await service.suggestMentions({
      q: toPlainText('/go[uû]t.*parfait.*'),
    })
    assert.ok(results)
  })

  it('only one year', async () => {
    const suggestions = await service.find({
      query: {
        q: '1947',
      },
    })

    assert.strictEqual(suggestions.data[0].daterange, '1947-01-01T00:00:00Z TO 1947-12-31T23:59:59Z')
  })

  it('two years', async () => {
    const suggestions = await app.service('suggestions').find({
      query: {
        q: '1950-1951',
      },
    })
    assert.strictEqual(suggestions.data[0].daterange, '1950-01-01T00:00:00Z TO 1951-12-31T23:59:59Z')
  })

  it('one year', async () => {
    const suggestions = await app.service('suggestions').find({
      query: {
        q: 'october 1950 to october 1951',
      },
    })
    assert.strictEqual(suggestions.data[0].daterange, '1950-10-01T10:00:00Z TO 1951-10-31T23:59:59Z')
  })

  it('one month', async () => {
    const suggestions = await app.service('suggestions').find({
      query: {
        q: 'october 1956',
      },
    })

    assert.strictEqual(suggestions.data[0].daterange, '1956-10-01T10:00:00Z TO 1956-10-31T23:59:59Z')
  })

  it('exact match with partial q', async () => {
    const suggestions = await app
      .service('suggestions')
      .find({
        query: {
          q: '"louis',
        },
      })
      .catch(err => {
        console.log(err)
        throw err
      })
    assert.ok(suggestions.data.length)
  })

  it('recognizes an invalid regexp', async () => {
    const suggestions = await app.service('suggestions').find({
      query: {
        q: '/*.*[/',
      },
    })
    assert.strictEqual(suggestions.data.length, 0)
  })
  it('recognizes a valid regexp and split on spaces', async () => {
    const suggestions = await app.service('suggestions').find({
      query: {
        q: '/go[uû]t.*parfait.*/',
      },
    })
    assert.strictEqual(suggestions.data[0].type, 'regex')
  })
})
