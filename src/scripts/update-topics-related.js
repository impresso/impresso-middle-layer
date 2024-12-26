const fs = require('fs')
const path = require('path')
const { chunk } = require('lodash')
const debug = require('debug')('impresso/scripts:update-topics-related')
const Eta = require('node-eta')
const app = require('../app')
const topics = require('../../data/topics.json')

const Threshold = parseFloat(process.env.THRESHOLD || 0.5)
const RelatedThreshold = parseFloat(process.env.RELATED_THRESHOLD || 0.1)
const MinArticlesIncommon = parseInt(process.env.MIN_IN_COMMON || 1, 10)
const MaxRelatedTopicsToKeep = 15
const LimitRelatedTopics = 300
const RelatedTopicsChunkSize = parseInt(process.env.CHUNK_SIZE || 2, 10)
const initialTopicUids = process.env.TOPICS ? process.env.TOPICS.split(',') : []
// topics filename, for fs;
const filename = path.join(__dirname, '../../data/topics.json')
// get all topics where is greater than threshold
let topicUids = Object.keys(topics)

const solrClient = app.service('cachedSolr')
const cacheManager = app.get('cacheManager')

const TtlFiveYears = 60 * 60 * 24 * 365 * 5
const CachePrefix = 'cache:script:update-topics-related:solr'

/**
 * Get data from Solr.
 * Using cache manager directly to cache data using custom cache keys to emphasise
 * that this data is cached differently from standard Solr requests. This data should stay
 * in cache until manually deleted.
 * @param {string} cacheKey
 * @param {*} request
 */
async function getDataFromSolr(cacheKey, request) {
  return cacheManager.wrap(cacheKey, () => solrClient.findAll(request, undefined, { skipCache: true }), TtlFiveYears)
}

if (initialTopicUids.length) {
  topicUids = topicUids.filter(d => initialTopicUids.includes(d))
  debug('limit to', initialTopicUids)
}
// eta instantiation
const eta = new Eta(topicUids.length, true)

async function waterfall() {
  // eslint-disable-next-line no-restricted-syntax
  for (const uid of topicUids) {
    debug(
      'topic:',
      uid,
      '- absolute count items:',
      topics[uid].countItems,
      '- Threshold:',
      Threshold,
      '- RelatedThreshold:',
      RelatedThreshold,
      '- MinArticlesIncommon:',
      MinArticlesIncommon
    )
    // ?q=topics_dpfs:tm-fr-all-v2.0_tp82_fr&fq={!frange l=0.5}
    // payload(topics_dpfs,tm-fr-all-v2.0_tp82_fr)&
    // fl=id,title,topics_dpfs&facet=on&json.facet={"topic":{"type":
    // "terms","field":"topics_dpfs","mincount":10,"limit": 10,"offset": 0,"numBuckets": true}}
    const query = {
      q: `topics_dpfs:${uid}`,
      limit: 0,
      offset: 0,
      fl: '*',
      fq: `{!frange l=${Threshold}}payload(topics_dpfs,${uid})`,
      namespace: 'search',
      facets: JSON.stringify({
        topic: {
          type: 'terms',
          field: 'topics_dpfs',
          mincount: MinArticlesIncommon, // at least 2 in common
          limit: LimitRelatedTopics,
          offset: 0,
          numBuckets: true,
        },
      }),
    }
    // eslint-disable-next-line no-await-in-loop
    const relatedTopicsUids = await getDataFromSolr(`${CachePrefix}:master-topic:${uid}`, query).then(
      ({ response, facets }) => {
        if (!facets || !facets.topic) {
          throw new Error(`Exit, threshold is not correct as no relatedtopics has been found for topic ${uid}`)
        }
        debug(
          'topic:',
          uid,
          '- n. relevant articles:',
          response.numFound,
          '- n. related topics in relevant articles:',
          facets.topic.numBuckets,
          '- % relevant articles:',
          (100 * response.numFound) / topics[uid].countItems
        )
        // second loop, for each buckets found, excluding self topic.
        return facets.topic.buckets.filter(({ val }) => val !== uid).map(d => d.val)
      }
    )

    // reset relatedTopics;
    // then loop throuh related topics
    topics[uid].degree = 0
    topics[uid].relatedTopics = []
    const relatedTopicsChunks = chunk(relatedTopicsUids, RelatedTopicsChunkSize)
    debug('topic:', uid, '- n. related topics:', relatedTopicsUids.length, '- n. chunks:', relatedTopicsChunks.length)
    // eslint-disable-next-line no-restricted-syntax
    for (const [i, relatedTopicsChunk] of relatedTopicsChunks.entries()) {
      // where articles are tagged with current topic with relevance at least `Threshold`
      // AND related topic with relevance at least `RelatedThreshold`.
      //
      // eslint-disable-next-line no-await-in-loop
      const relatedTopics = await Promise.all(
        relatedTopicsChunk.map(relatedUid => {
          const relatedQuery = {
            q: `{!frange l=${Threshold}}payload(topics_dpfs,${uid})`,
            limit: 0,
            offset: 0,
            // eslint-disable-next-line no-template-curly-in-string
            fl: '*,${combined_topic_weight}',
            vars: {
              combined_topic_weight: `sum(payload(topics_dpfs,${uid}),payload(topics_dpfs,${relatedUid}))`,
            },
            fq: `{!frange l=${RelatedThreshold}}payload(topics_dpfs,${relatedUid})`,
            namespace: 'search',
            facets: JSON.stringify({
              // eslint-disable-next-line no-template-curly-in-string
              avg_combined_topic_weight: 'avg(${combined_topic_weight})',
              // eslint-disable-next-line no-template-curly-in-string
              // max_combined_topic_weight: 'max(${combined_topic_weight})',
            }),
          }
          return getDataFromSolr(`${CachePrefix}:related-topics:${uid}:${relatedUid}`, relatedQuery).then(
            ({ response, facets }) => ({
              uid: relatedUid,
              w: response.numFound,
              avg: facets.avg_combined_topic_weight,
              // maxCombinedTopicWeight: facets.max_combined_topic_weight,
            })
          )
        })
      )
      topics[uid].relatedTopics = topics[uid].relatedTopics.concat(relatedTopics.filter(d => d.w > 0))
      debug('topic:', uid, '-> chunk:', i + 1, '/', relatedTopicsChunks.length)
    }

    // limit to top 10 related topics
    topics[uid].relatedTopicsStats = {
      MinArticlesIncommon,
      MaxRelatedTopicsToKeep,
      RelatedThreshold,
      Threshold,
    }
    topics[uid].degree = topics[uid].relatedTopics.length
    topics[uid].relatedTopics = topics[uid].relatedTopics
      .sort((a, b) => b.w * b.avgCombinedTopicWeight - a.w * a.avgCombinedTopicWeight)
      .slice(0, MaxRelatedTopicsToKeep)

    eta.iterate()
    debug(
      `ETA - progress: ${parseInt(eta.format('{{progress}}') * 10000, 10) / 100}%`,
      `- elapsed: ${eta.format('{{elapsed}}')} - eta: ${eta.format('{{etah}}')}`
    )
  }
  // , (err) => {
  //   if (err) {
  //     console.error(err);
  //   } else {
  //      // prints 60 after 2 seconds.
  //   }
  //   process.exit();

  //   // update topics
  fs.writeFileSync(filename, JSON.stringify(topics))
  debug(`success, saved ${filename}`)
  // });
  debug('done, exit.')
}

waterfall()
  .then(() => {
    process.exit(0)
  })
  .catch(e => {
    debug(`Error: ${e}`)
    console.error(e)
    process.exit(1)
  })
