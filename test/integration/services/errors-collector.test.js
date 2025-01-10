const assert = require('assert')
const app = require('../../../src/app')

/**
./node_modules/.bin/eslint \
test/services/errors-collector.test.js \
src/services/errors-collector \
--config .eslintrc.json --fix \
&& mocha test/services/errors-collector.test.js
*/
describe("'errors-collector' service", () => {
  let service

  before(() => {
    service = app.service('errors-collector')
  })

  it('registered the service', () => {
    assert.ok(service, 'Registered the service')
  })

  it('send BadRequest data to Error console', async () => {
    const stderr = await service.create({
      uri: 'issues.find',
      type: 'FeathersError',
      name: 'BadRequest',
      message: 'Error',
      code: 400,
      className: 'bad-request',
      data: { q: { code: 'NotValidLength', message: 'q param is not valid' } },
      errors: {},
      hook: {
        type: 'before',
        method: 'find',
        path: 'issues',
        params: {
          accessToken: '***',
          authentication: {
            strategy: 'jwt',
            payload: {},
          },
          user: {
            id: 1,
            username: 'super.user',
            firstname: 'Super',
            lastname: 'User',
            isStaff: true,
            isActive: true,
            isSuperuser: true,
            profile: {
              uid: 'superuser',
              provider: 'local',
              displayname: '',
              picture: 'null',
              pattern: [],
            },
            uid: 'superuser',
          },
          query: {
            page: 1,
            limit: 36,
            order_by: '-date',
          },
        },
      },
    })
    console.log(stderr)
  })
})
