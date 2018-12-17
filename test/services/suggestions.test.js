const assert = require('assert');
const app = require('../../src/app');
const { getMentions, getTopics } = require('../../src/services/suggestions/suggestions.class.js').utils;
/*

 ./node_modules/.bin/eslint \
 test/services/suggestions.test.js  \
 src/services/suggestions \
 --config .eslintrc.json --fix &&
 mocha test/services/suggestions.test.js

*/

describe('\'suggestions\' service', function () {
  this.timeout(10000);
  it('registered the service', () => {
    const service = app.service('suggestions');

    assert.ok(service, 'Registered the service');
  });

  it('test getTopics sub service', async () => {
    const results = await getTopics({
      config: app.get('solr'),
      params: {
        query: {
          q: 'suiss',
        },
      },
    });
    console.log(results);
    assert.ok(results);
    // assert.ok(results[0]., 'Contains a Mention suggestion object');
  });

  it('test NEW getMentions sub service', async () => {
    const results = await getMentions({
      config: app.get('solr'),
      params: {
        query: {
          q: 'suiss',
        },
      },
    });
    // console.log(results);
    assert.ok(results);
    // assert.ok(results[0]., 'Contains a Mention suggestion object');
  });

  it('test getMentions sub service', async () => {
    const results = await getMentions({
      config: app.get('solr'),
      params: {
        query: {
          q: '/go[uû]t.*parfait.*',
        },
      },
    });

    assert.equal(results.length, 0);
    // assert.ok(results[0].type, 'Contains a Mention suggestion object');
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
    // console.log(suggestions);
    assert.ok(suggestions.data.length);
    // assert.equal(suggestions.data[0].daterange, '1956-10-01T10:00:00Z TO 1956-10-31T23:59:59Z');
  });

  it('recognizes an invalid regexp', async () => {
    const suggestions = await app.service('suggestions').find({
      query: {
        q: '/*.*[/',
      },
    });
    assert.equal(suggestions.data.length, 0);
  });
  it('recognizes a valid regexp and split on spaces', async () => {
    const suggestions = await app.service('suggestions').find({
      query: {
        q: '/go[uû]t.*parfait.*/',
      },
    });
    assert.equal(suggestions.data[0].type, 'regex');
  });
});
