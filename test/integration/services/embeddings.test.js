const assert = require('assert')
const app = require('../../../src/app')
/*
./node_modules/.bin/eslint  \
src/services/embeddings \
test/services/embeddings.test.js \
--config .eslintrc.json --fix \
&& NODE_ENV=development DEBUG=verbose*,imp* mocha test/services/embeddings.test.js
*/
describe("'embeddings' service", () => {
  let service

  before(() => {
    service = app.service('embeddings')
  })

  it('registered the service', () => {
    assert.ok(service, 'Registered the service')
  })

  it('should not work (BadRequest) with multiple words', async () =>
    service
      .find({
        query: {
          q: 'amour folie',
          language: 'fr',
        },
      })
      .then(() => {
        assert.fail("no no no, it's not possible")
      })
      .catch(err => {
        assert.strictEqual(err.name, 'BadRequest')
      }))

  it('should not work (NotFound) with words that do not exist in our embeddings', async () =>
    service
      .find({
        query: {
          q: 'Vélozzome',
          language: 'fr',
        },
      })
      .then(() => {
        assert.fail("no no no, it's not possible")
      })
      .catch(err => {
        assert.strictEqual(err.name, 'NotFound')
      }))

  it('should work even with accents and weird characters', async () => {
    const result = await service.find({
      query: {
        q: 'Vélo',
        language: 'fr',
      },
    })
    // closest one: vélo
    assert.strictEqual(result.data[0], 'vélo')
  })
})
