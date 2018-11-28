const assert = require('assert');
const wikidata = require('../../src/services/wikidata');

/*

./node_modules/.bin/eslint test/services/wikidata.test.js  \
src/services/wikidata.js --fix \
&& DEBUG=impresso/* mocha test/services/wikidata.test.js

*/
describe('test wikidata', function () {
  this.timeout(5000);

  it.only('get wikidata Q42', async () => {
    const entity = await wikidata.resolve({
      ids: ['Q42'],
    });
    console.log(entity);
    assert.ok(entity);
  });
});
