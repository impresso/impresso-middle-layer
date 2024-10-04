// import tags from a well defined list of tags
const fs = require('fs')
const lodash = require('lodash')
const debug = require('debug')('impresso/scripts:update-data')
const config = require('@feathersjs/configuration')()()
const solrClient = require('../solr').client(config.solr, config.solrConnectionPool)
const Topic = require('../models/topics.model')

debug('start!')

async function waterfall() {
  debug('find topics...')
  const topics = await solrClient
    .findAll(
      {
        q: '*:*',
        limit: 1000,
        offset: 0,
        fl: '*',
        namespace: 'topics',
      },
      Topic.solrFactory
    )
    .then(result => {
      debug(`${result.response.numFound} topics found in ${result.responseHeader.QTime} ms`)
      return result.response.docs.map(d => ({
        ...d,
        words: lodash.take(d.words, 10),
      }))
    })
    .then(results => lodash.keyBy(results, 'uid'))

  debug('get topics links...')

  await Object.keys(topics).reduce(async (promise, topicUid) => {
    // await ['tmrero-fr-alpha_tp47_fr'].reduce(async (promise, topicUid) => {
    await promise
    debug('topic:', topicUid)
    const result = await solrClient.findAll({
      q: `topics_dpfs:${topicUid}`,
      limit: 0,
      offset: 0,
      fl: 'id',
      // facets: JSON.stringify({
      //   topic: {
      //     type: 'terms',
      //     field: 'topics_dpfs',
      //     mincount: 2, // at least 2 in common
      //     limit: 20,
      //     offset: 0,
      //     numBuckets: true,
      //   },
      // }),
      namespace: 'search',
    })
    topics[topicUid].countItems = result.response.numFound
    // if (!result.facets.topic) {
    //   console.warn('the topic does not seem to exist...', result.facets, result.response);
    //   topics[topicUid].relatedTopics = [];
    // } else {
    //   debug(`${result.facets.topic.numBuckets} rels`);
    //   topics[topicUid].degree = result.facets.topic.numBuckets;
    //   topics[topicUid].relatedTopics = result.facets.topic.buckets.map(d => ({
    //     uid: d.val,
    //     w: d.count,
    //   }));
    // }
    // enrich topic
    // console.log(result.facets.topic.buckets);
  }, Promise.resolve())

  debug('saving', Object.keys(topics).length, 'topics...')

  const fileName = './data/topics.json'
  fs.writeFileSync(fileName, JSON.stringify(topics))
  debug(`success, saved ${fileName}`)
}

waterfall()
  .then(() => {
    debug('done, exit.') // prints 60 after 2 seconds.
    process.exit(0)
  })
  .catch(err => {
    console.log(err)
    process.exit(1)
  })
