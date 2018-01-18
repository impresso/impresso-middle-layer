const assert = require('assert');
const { sanitize, utils } = require('../../src/hooks/params');
// usage from cli:
// mocha test/hooks/params.test.js 
describe('\'params\' hook', () => {
  it('should runs sanitize filter correctly with custom filter', (done) => {

    done()
  });

  [
    ['ciao "mamma Bella" e ciao"', '*ciao* AND "mamma Bella" AND *ciao*'],
    ['amsterdam OR paris', 'amsterdam OR paris'],
    ['*amsterdam* paris', '*amsterdam* AND paris'],
    // @todo ['amsterdam*, roma', 'amsterdam* OR roma']
  ].map(d => {
    it('should transform: /' + d[0] + '/ to lucene query: /'+ d[1]+'/', (done) => {
      assert.equal(utils.toLucene(d[0]),d[1])
      done();
    })
  })
  
});
