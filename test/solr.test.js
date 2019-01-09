const assert = require('assert');
const config = require('@feathersjs/configuration')()();
const solr = require('../src/solr');
const Article = require('../src/models/articles.model');
const Issue = require('../src/models/issues.model');

const solrClient = solr.client(config.solr);

/*
./node_modules/.bin/eslint \
test/solr.test.js \
src/solr.js \
--config .eslintrc.json --fix \
&& NODE_ENV=sandbox DEBUG=impresso* mocha test/solr.test.js

 */
describe('test solr connection', function () {
  this.timeout(5000);

  it('check count', async () => {
    const results = await solrClient.findAll({
      q: '*:*',
      limit: 1,
      fl: 'id',
    }, Article.solrFactory);
    assert.ok(results.response.numFound);
  });

  it('test collapse by fieldname', async () => {
    const results = await solrClient.findAll({
      q: '*:*',
      limit: 1,
      fl: Issue.ISSUE_SOLR_FL_MINIMAL,
      namespace: 'search',
      collapse_by: 'meta_issue_id_s',
      // get first ARTICLE result
      collapse_fn: 'sort=\'id ASC\'',
    }, Issue.solrFactory);
    console.log(results.response.docs);
    assert.ok(results.response.numFound);
  });

  it('test update against a real article id (sandbox only!!)', async () => {
    if (process.env.NODE_ENV !== 'sandbox') {
      return;
    }
    const id = 'GDL-1892-10-07-a-i0003';// 'GDL-1967-04-25-a-i0152';
    const results = await solrClient.update({
      id,
      namespace: 'search',
      set: {
        ucoll_plain: {
          set: 'PRI-test-local',
        },
      },
    });
    assert.ok(results);

    const updated = await solrClient.findAll({
      q: `id:${id}`,
      fl: 'id,ucoll_plain',
      limit: 1,
      skip: 0,
      namespace: 'search',
    });
    console.log(updated.response);
  });
});
