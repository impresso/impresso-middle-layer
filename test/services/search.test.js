const assert = require('assert');
const app = require('../../src/app');


/**
 * Test for search endpoint. Usage: ``` DEBUG=impresso/* mocha test/services/search.test.js ```
 */
describe('\'search\' service', () => {
  const service = app.service('search');

  it('registered the service', () => {
    assert.ok(service, 'Registered the service');
  });
  // it('loaded solr content', (done) => {
  //   service.find({
  //     query:{
  //       q: 'monsieur',
  //       group_by: 'articles'
  //     }
  //   }).then(res => {
  //     // console.log(res.data);
  //     assert.ok(res.data.length, 'There are results');
  //     done();
  //   }).catch(err => {
  //     console.log(err.data);
  //     done();
  //   })
  // });

  it('loaded solr content with facets', (done) => {
    service.find({
      query:{
        q: 'monsieur',
        group_by: 'articles',
        limit: 1,
        facets: [
          'language',
        ]
      }
    }).then(res => {
      console.log(res.data);
      done();
    }).catch(err => {
      console.log(err.data);
      done();
    })
    assert.ok(service, 'Registered the service');
  });
});
