const assert = require('assert');
const { neo4jToLucene } = require('../src/services/neo4j.utils');

/**
 * Usage, eslint + mocha
 * ./node_modules/.bin/eslint
 * test/services/neo4j.utils.test.js src/services/neo4j.utils.js --fix
 * &&
 * DEBUG=impresso* mocha test/services/neo4j.utils.test.js
 */
describe('\'neo4j\' neo4jToLucene', () => {
  it('one word, handle incomplete quotes', () => {
    assert.equal(neo4jToLucene('"louis'), '"louis"');
  });
  it('one word, handle complete quotes', () => {
    assert.equal(neo4jToLucene('"louis"'), '"louis"');
  });
  it('multiple words, fuzzy', () => {
    assert.equal(neo4jToLucene('louis mon'), 'louis* AND mon*');
  });
  it('multiple words, surrounded by quotes', () => {
    assert.equal(neo4jToLucene('"louis mon"'), '"louis" AND "mon"');
  });
  it('multiple words, ignore quotes in the middle to avoid ParserErrors', () => {
    assert.equal(neo4jToLucene('louis "mon"'), 'louis* AND mon*');
  });
});
