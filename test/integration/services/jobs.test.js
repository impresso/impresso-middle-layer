const assert = require('assert');
const app = require('../../../src/app');

/**
 * use with
 ./node_modules/.bin/eslint \
 src/models \
 test/services/jobs.test.js  \
 src/services/jobs src/hooks \
 --config .eslintrc.json --fix \
 && DEBUG=impresso/* mocha test/services/jobs.test.js
 */
describe('\'jobs\' service', () => {
  const service = app.service('jobs');

  it('registered the service', () => {
    assert.ok(service, 'Registered the service');
  });
  it('create test job', async () => {
    const result = await service.create({}, {
      user: {
        id: 1,
      },
    });
    console.log(result);
  });
});
