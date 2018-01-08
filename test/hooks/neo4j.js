const assert = require('assert');
const { sanitize, normalize, finalize, finalizeMany } = require('../../src/hooks/neo4j');

describe('\'neo4j\' hook', () => {
  it('runs sanitize', () => {
    // A mock context hook object
    const mock = {};
    // Initialize our hook with no options
    const hook = gravatar();

    // Run the hook function (which returns a promise)
    // and compare the resulting hook object
    return hook(mock).then(result => {
      assert.equal(result, mock, 'Returns the expected hook object');
    });
  });
});
