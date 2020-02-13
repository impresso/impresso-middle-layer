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
  const years = await solrClient.findAll({
    q: '*:*',
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
        c: bucket.count,
      },
    });
    return acc;
  }, {}));

  await solrClient.findAll({
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
  }).then(res => res.facets.year.buckets.forEach((bucket) => {
    // save to the dictionary year:Year instance
    years[bucket.val].refs.a = parseFloat(bucket.count);
  }, {}));

  await solrClient.findAll({
    q: 'filter(_vector_ResNet50_bv:[* TO *])',
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
    namespace: 'images',
  }).then(res => res.facets.year.buckets.forEach((bucket) => {
    // save to the dictionary year:Year instance
    years[bucket.val].refs.m = parseFloat(bucket.count);
  }, {}));

  console.log(years);

  debug('saving', Object.keys(years).length, 'years ...');

  const fileName = './data/years.json';
  fs.writeFileSync(fileName, JSON.stringify(years));
  debug(`success, saved ${fileName}`);
}

waterfall().then(() => {
  debug('done, exit.'); // prints 60 after 2 seconds.
  process.exit();
}).catch((err) => {
  console.log(err);
  process.exit();
});
