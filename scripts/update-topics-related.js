const fs = require('fs');
const path = require('path');
const debug = require('debug')('impresso/scripts:update-topics-related');
const config = require('@feathersjs/configuration')()();
const solrClient = require('../src/solr').client(config.solr);
const topics = require('../data/topics.json');

const Threshold = parseFloat(process.env.THRESHOLD || 0.5);
const RelatedThreshold = parseFloat(process.env.RELATED_THRESHOLD || 0.1);
const MinArticlesIncommon = parseInt(process.env.MIN_IN_COMMON || 2, 10);
const MaxRelatedTopicsToKeep = 10;
const LimitRelatedTopics = 300;

// topics filename, for fs;
const filename = path.join(__dirname, '../data/topics.json');
// get all topics where is greater than threshold
const topicUids = Object.keys(topics);

async function waterfall() {
  // eslint-disable-next-line no-restricted-syntax
  for (const uid of topicUids) {
    debug(
      'topic:', uid,
      '- absolute count items:', topics[uid].countItems,
      '- Threshold:', Threshold,
      '- RelatedThreshold:', RelatedThreshold,
      '- MinArticlesIncommon:', MinArticlesIncommon,
    );
    // ?q=topics_dpfs:tm-fr-all-v2.0_tp82_fr&fq={!frange l=0.5}
    // payload(topics_dpfs,tm-fr-all-v2.0_tp82_fr)&
    // fl=id,title,topics_dpfs&facet=on&json.facet={"topic":{"type":
    // "terms","field":"topics_dpfs","mincount":10,"limit": 10,"offset": 0,"numBuckets": true}}
    // eslint-disable-next-line no-await-in-loop
    const relatedTopicsUids = await solrClient.findAll({
      q: `topics_dpfs:${uid}`,
      limit: 0,
      skip: 0,
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
    }).then(({ response, facets }) => {
      if (!facets || !facets.topic) {
        throw new Error(`Exit, threshold is not correct as no relatedtopics has been found for topic ${uid}`);
      }
      debug(
        'topic:', uid,
        '- n. relevant articles:', response.numFound,
        '- n. related topics in relevant articles:', facets.topic.numBuckets,
        '- % relevant articles:', 100 * response.numFound / topics[uid].countItems,
      );
      // second loop, for each buckets found, excluding self topic.
      return facets.topic.buckets
        .filter(({ val }) => val !== uid)
        .map(d => d.val);
    });

    // reset relatedTopics;
    // then loop throuh related topics
    topics[uid].degree = relatedTopicsUids.length;
    topics[uid].relatedTopics = [];
    debug('topic:', uid, '- n. related topics:', relatedTopicsUids.length);

    // eslint-disable-next-line no-restricted-syntax
    for (const relatedUid of relatedTopicsUids) {
      // where articles are tagged with current topic with relevance at least `Threshold`
      // AND related topic with relevance at least `RelatedThreshold`.
      //
      // eslint-disable-next-line no-await-in-loop
      const [numEdges, avgCombinedTopicWeight, maxCombinedTopicWeight] = await solrClient.findAll({
        q: `{!frange l=${Threshold}}payload(topics_dpfs,${uid})`,
        limit: 0,
        skip: 0,
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
          max_combined_topic_weight: 'max(${combined_topic_weight})',
        }),
      }).then(({ response, facets }) => [
        response.numFound,
        facets.avg_combined_topic_weight,
        facets.max_combined_topic_weight,
      ]);

      if (numEdges >= MinArticlesIncommon) {
        // add link to relatedTopics in topic.
        topics[uid].relatedTopics.push({
          uid: relatedUid,
          w: numEdges,
          // avgCombinedTopicWeight,
          // maxCombinedTopicWeight,
        });
      }
      debug(
        'topic:', uid, '-> topic:', relatedUid,
        '- n. relevant articles in common:', numEdges,
        '- avgCombinedTopicWeight:', avgCombinedTopicWeight,
        '- maxCombinedTopicWeight:', maxCombinedTopicWeight,
      );
    }

    // limit to top 10 related topics
    topics[uid].relatedTopicsStats = {
      MinArticlesIncommon,
      MaxRelatedTopicsToKeep,
      RelatedThreshold,
      Threshold,
    };

    topics[uid].relatedTopics = topics[uid].relatedTopics
      .sort((a, b) => b.w - a.w)
      .slice(0, MaxRelatedTopicsToKeep);
    // throw new Error('CUSTOM BREAK');
  }
  // , (err) => {
  //   if (err) {
  //     console.error(err);
  //   } else {
  //      // prints 60 after 2 seconds.
  //   }
  //   process.exit();

  //   // update topics
  fs.writeFileSync(filename, JSON.stringify(topics));
  debug(`success, saved ${filename}`);
  // });
  debug('done, exit.');
}

waterfall();
