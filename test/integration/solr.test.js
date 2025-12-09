import assert from 'assert'
import config from '@feathersjs/configuration'
import solr from '../../src/solr'
import Article from '../../src/models/articles.model'
import Issue from '../../src/models/issues.model'

const solrClient = solr.client(config.solr, config.solrConnectionPool)

/*
./node_modules/.bin/eslint \
test/solr.test.js \
src/solr.js \
--config .eslintrc.json --fix \
&& NODE_ENV=sandbox DEBUG=impresso* mocha test/solr.test.js

 */
describe('test solr connection', function () {
  this.timeout(5000)

  it('check count', async () => {
    const results = await solrClient.findAll(
      {
        q: '*:*',
        limit: 1,
        fl: 'id',
      },
      Article.solrFactory
    )
    assert.ok(results.response.numFound)
  })

  it('test collapse by fieldname', async () => {
    const results = await solrClient.findAll(
      {
        q: '*:*',
        limit: 1,
        fl: Issue.ISSUE_SOLR_FL_MINIMAL,
        namespace: 'search',
        collapse_by: 'meta_issue_id_s',
        // get first ARTICLE result
        collapse_fn: "sort='id ASC'",
      },
      Issue.solrFactory
    )
    console.log(results.response.docs)
    assert.ok(results.response.numFound)
  })

  it('test update against a real article id', async () => {
    const id = 'GDL-1938-10-14-a-i0092' // 'GDL-1967-04-25-a-i0152';
    const results = await solrClient.update({
      id,
      namespace: 'search',
      add: {
        ucoll_ss: {
          add: 'test',
        },
      },
    })
    // "id":"GDL-1938-10-14-a-i0092",
    //                 "ucoll_ss": {
    //                     "add": collection.pk
    //                 }
    console.log(results)
    assert.ok(results)

    const updated = await solrClient.findAll({
      q: `id:${id}`,
      fl: 'id,ucoll_ss',
      limit: 1,
      offset: 0,
      namespace: 'search',
    })
    console.log(updated.response)
  })
})
