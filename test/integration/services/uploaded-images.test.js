const assert = require('assert')
const app = require('../../../src/app')
/**
./node_modules/.bin/eslint  \
src/services/uploaded-images \
--config .eslintrc.json --fix \
&& NODE_ENV=development DEBUG=imp* mocha test/services/uploaded-images.test.js
*/
describe("'uploaded-images' service", function () {
  this.timeout(10000)

  let service

  before(() => {
    service = app.service('uploaded-images')
  })

  it('registered the service', () => {
    assert.ok(service, 'Registered the service')
  })

  it('get all images for one user', async () => {
    const result = await service.find({
      user: {
        id: 1,
      },
    })
    console.log(result)
  })
})
