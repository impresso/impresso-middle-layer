/**
 * this script updates the global timelines, of articles and issues
 * NODE_ENV=development DEBUG=impresso* npm run update-timelines
 */
const fs = require('fs');
const debug = require('debug')('impresso/scripts:update-timelines');
const config = require('@feathersjs/configuration')()();
const solrClient = require('../src/solr').client(config.solr);

const Year = require('../src/models/years.model');

debug('start!');

async function waterfall() {
  debug('timeline of contentItems having textual contents...');
  // const total
  const withTextContents = await solrClient.findAll({
    q: 'content_length_i:[1 TO *]',
    limit: 0,
    fl: 'id',
    facets: JSON.stringify({
      year: {
        type: 'terms',
        field: 'meta_year_i',
        mincount: 1,
        limit: 400,
      },
    }),
    namespace: 'search',
  }).then(res => res.facets.year.buckets.reduce((acc, bucket) => {
    // save a dictionary year:Year instance
    acc[bucket.val] = new Year({
      y: bucket.val,
      refs: {
        a: bucket.count,
      },
    });
    return acc;
  }, {}));
  console.log(withTextContents);

  debug('saving', Object.keys(withTextContents).length, 'years withTextContents...');

  fs.writeFileSync('./src/data/years.json', JSON.stringify(withTextContents));
  debug('success, saved ./src/data/years.js');
}

waterfall().then(() => {
  debug('done, exit.'); // prints 60 after 2 seconds.
  process.exit();
}).catch((err) => {
  console.log(err);
  process.exit();
});
