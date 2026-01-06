import assert from 'assert'
import app from '@/app'

/**
./node_modules/.bin/eslint  \
src/models src/services/topics src/hooks test/services/topics.test.js \
--config .eslintrc.json --fix \
&& DEBUG=impresso* mocha test/services/topics.test.js
*/
describe("'topics' service", () => {
  let service

  before(() => {
    service = app.service('topics')
  })

  it('registered the service', () => {
    assert.ok(service, 'Registered the service')
  })

  it('should not raise an issue when q is null (from socket)', async () => {
    const results = await service.find({
      query: {
        q: null,
      },
    })
    assert.ok(results.data[0])
  })

  // it('use filters to get topics from one model only', async () => {
  //   const results = await service.find({
  //     query: {
  //       filters: [
  //         {
  //           type: 'topicmodel',
  //           q: 'tmJDG',
  //         },
  //       ],
  //     },
  //   });
  //   assert.equal(results.data[0].model, 'tmJDG');
  // });
  //
  // it('use filters to get topics with facets', async () => {
  //   const results = await service.find({
  //     query: {
  //       facets: 'topicmodel',
  //       filters: [
  //         {
  //           type: 'topicmodel',
  //           q: 'tmJDG',
  //         },
  //       ],
  //     },
  //   });
  //   console.log(results.info);
  //   assert.equal(results.data[0].model, 'tmJDG');
  // });
})
