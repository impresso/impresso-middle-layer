const assert = require('assert');
const app = require('../../src/app');

describe('\'articles\' service', () => {
  it('registered the service', (done) => {
    const service = app.service('articles');
    service.find({
      query: {
        filters: [
          {
            type: 'entity',
            context: 'include',
          },
        ],
      },
    }).then((res) => {
      assert.ok(res.data);
      assert.ok(res.total);
      done();
    }).catch((err) => {
      console.log(err.data);
      done();
    }); // [type]=entity&filters[0][context]=include
  });
});
