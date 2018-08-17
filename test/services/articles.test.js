const assert = require('assert');
const app = require('../../src/app');

/*
  ./node_modules/.bin/eslint \
  src/services/articles test/services/articles.test.js --fix &&
  DEBUG=impresso/* mocha test/services/articles.test.js
*/
describe('\'articles\' service', () => {
  const service = app.service('articles');
  it('registered the service', () => {
    assert.ok(service);
  });
  it('find endpoint should just work', async () => {
    const result = await service.find({
      query: {},
    }).catch((err) => {
      console.log(err.data);
    }); // [type]=entity&filters[0][context]=include

    assert.ok(result.data);
    assert.ok(result.data[0].issue);
    assert.ok(result.data[0].pages);
    assert.equal(result.data[0].labels[0], 'article');
    // assert.ok(res.total);
  });

  it('get an article contents given an article id', async () => {
    const result = await service.get('GDL-1954-06-29-a-i0084').catch((err) => {
      console.log(err.data);
    }); // [type]=entity&filters[0][context]=include

    assert.equal(result.uid, 'GDL-1954-06-29-a-i0084');
    assert.ok(result.regions, 'Check image regions');
    assert.ok(result.contents, 'Check property contents');
    assert.ok(result.excerpt, 'Check property excerpt');
    assert.ok(result.title, 'Check property title');
    // assert.ok(res.total);
  });
});
