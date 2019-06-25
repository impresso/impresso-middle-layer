const assert = require('assert');
const { obfuscate } = require('../../src/hooks/access-rights');
const { ACCESS_RIGHTS_CLOSED, ACCESS_RIGHTS_OPEN_PUBLIC } = require('../../src/models/issues.model');

/*
./node_modules/.bin/eslint \
src/hooks/access-rights.js test/hooks/access-rights.test.js --config .eslintrc.json --fix &&
mocha test/hooks/access-rights.test.js
*/

describe('test obfuscation when the user is anonymous', () => {
  it('filter out when issue hass access rights ACCESS_RIGHTS_CLOSED', () => {
    const context = {
      type: 'after',
      params: {

      },
      result: {
        data: [
          {
            content: 'Private content, do not Disclose.',
            issue: {
              accessRights: ACCESS_RIGHTS_CLOSED,
            },
          },
        ],
      },
    };
    obfuscate()(context);
    assert.ok(context.obfuscated);
    assert.ok(context.result.data[0].content !== 'Private content, do not Disclose.');
  });

  it('filter out when issue is under ACCESS_RIGHTS_OPEN_PUBLIC', () => {
    const context = {
      type: 'after',
      params: {

      },
      result: {
        data: [
          {
            content: 'Public accessible content.',
            issue: {
              accessRights: ACCESS_RIGHTS_OPEN_PUBLIC,
            },
          },
        ],
      },
    };
    obfuscate()(context);
    assert.ok(context.obfuscated);
    assert.deepEqual(context.result.data[0].content, 'Public accessible content.');
  });
});
