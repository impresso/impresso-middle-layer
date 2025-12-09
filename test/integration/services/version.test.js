import assert from 'assert'
import app from '../../../src/app'
/**
 *
./node_modules/.bin/eslint \
src/services/version test/services/version.test.js --fix &&
mocha test/services/version.test.js

*/
describe("'version' service", () => {
  let service

  before(() => {
    service = app.service('version')
  })

  it('registered the service', () => {
    assert.ok(service, 'Registered the service')
  })
})
