// import tags from a well defined list of tags
const fs = require('fs');
const lodash = require('lodash');
const debug = require('debug')('impresso/scripts:update-data');
const config = require('@feathersjs/configuration')()();
const solrClient = require('../src/solr').client(config.solr);
const Topic = require('../src/models/topics.model');

debug('start!');

async function waterfall() {
  debug('find topics...');
  const topics = await solrClient.findAll({
    q: '*:*',
    limit: 1000,
    skip: 0,
    fl: '*',
    namespace: 'topics',
  }, Topic.solrFactory)
    .then((result) => {
      debug(`${result.response.numFound} topics found in ${result.responseHeader.QTime} ms`);
      return result.response.docs.map(d => ({
        ...d,
        words: lodash.take(d.words, 10),
      }));
    })
    .then(results => lodash.keyBy(results, 'uid'));

  debug('get topics links...');

  await Object.keys(topics).reduce(async (promise, topicUid) => {
  // await ['tmrero-fr-alpha_tp47_fr'].reduce(async (promise, topicUid) => {
    await promise;
    debug('topic:', topicUid);
    const result = await solrClient.findAll({
      q: `topics_dpfs:${topicUid}`,
      limit: 0,
      skip: 0,
      fl: '*',
      facets: JSON.stringify({
        topic: {
          type: 'terms',
          field: 'topics_dpfs',
          mincount: 1,
          limit: 10,
          offset: 0,
          numBuckets: true,
        },
      }),
      namespace: 'search',
    });
    topics[topicUid].countItems = result.response.numFound;
    topics[topicUid].relatedTopics = result.facets.topic.buckets.map(d => ({
      uid: d.val,
      w: d.count,
    }));
    // enrich topic
    // console.log(result.facets.topic.buckets);
  }, Promise.resolve());

  debug('saving', Object.keys(topics).length, 'topics...');

  fs.writeFileSync('./src/data/topics.json', JSON.stringify(topics));
  debug('success, saved ./src/data/topics.js');
}

waterfall().then(() => {
  debug('done, exit.'); // prints 60 after 2 seconds.
  process.exit();
}).catch((err) => {
  console.log(err);
  process.exit();
});
