const assert = require('assert');
const app = require('../../src/app');

/*
  ./node_modules/.bin/eslint \
  src/services/articles test/services/articles.test.js --fix &&
  DEBUG=impresso/* mocha test/services/articles.test.js

  or, without debug

  ./node_modules/.bin/eslint \
  src/services/articles test/services/articles.test.js --fix &&
  mocha test/services/articles.test.js
*/
describe('\'articles\' service', function () {
  this.timeout(5000);
  const service = app.service('articles');
  it('registered the service', () => {
    assert.ok(service);
  });
  it('find endpoint should just work', async () => {
    const result = await service.find({
      query: {},
    }).catch((err) => {
      assert.fail(err.data);
    });

    assert.ok(result.data);
    assert.ok(result.data[0].issue);
    assert.ok(result.data[0].pages);
    assert.equal(result.data[0].labels[0], 'article');
  });

  it('find given an issue filter', async () => {
    const result = await service.find({
      query: {
        filters: [{
          type: 'issue',
          q: 'GDL-1947-03-12-a',
        }],
      },
    }).catch((err) => {
      assert.fail(err.data);
    });
    assert.ok(result.total);
    assert.ok(result.data[0].uid);
    assert.equal(result.data[0].labels[0], 'article');
    assert.equal(result.info.filters[0].q, 'GDL-1947-03-12-a');
  });

  it('find given a single page filter', async () => {
    const result = await service.find({
      query: {
        filters: [{
          type: 'page',
          q: 'GDL-1902-05-12-a-p0002',
        }],
      },
    }).catch((err) => {
      assert.fail(err.data);
    });
    assert.ok(result.total);
    assert.ok(result.data[0].uid);
    assert.equal(result.data[0].labels[0], 'article');
    assert.equal(result.data[0].regions[0].pageUid, 'GDL-1902-05-12-a-p0002');
    assert.ok(result.data[0].regions[0].coords);
    assert.ok(result.data[0].regions[0].iiif_fragment);
  });

  it('get an article contents given an article id', async () => {
    const result = await service.get('GDL-1954-06-29-a-i0084').catch((err) => {
      assert.fail(err.data);
    });
    assert.equal(result.uid, 'GDL-1954-06-29-a-i0084');
    assert.ok(result.regions, 'Check image regions');
    assert.ok(result.content, 'Check property content');
    assert.ok(result.excerpt, 'Check property excerpt');
    assert.ok(result.title, 'Check property title');
    // assert.ok(res.total);
  });

  it('get multiple articles given a article ids', async () => {
    const results = await service.get('GDL-1954-06-29-a-i0084,GDL-1951-04-23-a-i0096').catch((err) => {
      assert.fail(err.data);
    }); // [type]=entity&filters[0][context]=include
    // console.log(results);
    assert.ok(results.length);

    // should NOT have contents....
    assert.ok(results[0].uid, 'Check result');
    assert.ok(!results[0].contents, true);
    assert.ok(results[0].title, 'Check property title');
    // assert.ok(res.total);
  });
});
