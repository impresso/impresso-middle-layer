const assert = require('assert');
const app = require('../../src/app');

describe('\'suggestions\' service', () => {
  it('registered the service', () => {
    const service = app.service('suggestions');

    assert.ok(service, 'Registered the service');
  });

  // it('say hello', async () => {
  //   const suggestions = app.service('suggestions').find({
  //     query: {
  //       q: 'pau',
  //     },
  //   })
  //
  //   assert.ok(suggestions);
  // });
  it('only one year', async () => {
    const suggestions = await app.service('suggestions').find({
      query: {
        q: '1947',
      },
    });

    assert.equal(suggestions.data[0].daterange, '1947-01-01T00:00:00Z TO 1947-12-31T23:59:59Z');
  });

  it('two years', async () => {
    const suggestions = await app.service('suggestions').find({
      query: {
        q: '1950-1951',
      },
    });
    assert.equal(suggestions.data[0].daterange, '1950-01-01T00:00:00Z TO 1951-12-31T23:59:59Z');
  });

  it('one year', async () => {
    const suggestions = await app.service('suggestions').find({
      query: {
        q: 'october 1950 to october 1951',
      },
    });
    assert.equal(suggestions.data[0].daterange, '1950-10-01T10:00:00Z TO 1951-10-31T23:59:59Z');
  });

  it('one month', async () => {
    const suggestions = await app.service('suggestions').find({
      query: {
        q: 'october 1956',
      },
    });

    assert.equal(suggestions.data[0].daterange, '1956-10-01T10:00:00Z TO 1956-10-31T23:59:59Z');
  });

  it('exact match with partial q', async () => {
    const suggestions = await app.service('suggestions').find({
      query: {
        q: '"louis',
      },
    }).catch((err) => {
      console.log(err);
      throw err;
    });
    console.log(suggestions);
    assert.ok(suggestions.data.length);
    // assert.equal(suggestions.data[0].daterange, '1956-10-01T10:00:00Z TO 1956-10-31T23:59:59Z');
  });
});
