// import tags from a well defined list of tags
const fs = require('fs');
const lodash = require('lodash');
const debug = require('debug')('impresso/scripts:update-data');
const config = require('@feathersjs/configuration')()();
const sequelizeClient = require('../src/sequelize').client(config.sequelize);
const solrClient = require('../src/solr').client(config.solr);

const Newspaper = require('../src/models/newspapers.model');
const Issue = require('../src/models/issues.model');


debug('start!');

async function waterfall() {
  debug('find newspapers...');

  const newspapers = await Newspaper.sequelize(sequelizeClient).scope('all').findAll()
    .then(results => results.map(d => d.toJSON()))
    .then(results => lodash.keyBy(results, 'acronym'));

  // get total pages per newspapers
  await sequelizeClient.query(`SELECT COUNT(*) as countPages, p.newspaper_id as uid
       FROM pages AS p
     GROUP BY p.newspaper_id`, {
    type: sequelizeClient.QueryTypes.SELECT,
  }).then((results) => {
    results.forEach((d) => {
      newspapers[d.uid].countPages = d.countPages;
    });
  }).catch((err) => {
    console.log(err);
  });

  // get (real) articles!
  await solrClient.findAll({
    q: 'filter(content_length_i:[1 TO *])',
    limit: 0,
    skip: 0,
    fl: 'id',
    facets: JSON.stringify({
      newspaper: {
        type: 'terms',
        field: 'meta_journal_s',
        mincount: 1,
        limit: 1000,
        numBuckets: true,
      },
    }),
  }).then((results) => {
    results.facets.newspaper.buckets.forEach((d) => {
      newspapers[d.val].countArticles = d.count;
    });
  });

  // get firstIssue and lastIssue
  await sequelizeClient.query(`SELECT n.id as uid, MIN(iss.id) as firstIssue, MAX(iss.id) as lastIssue, COUNT(iss.id) as countIssues
       FROM issues as iss
       JOIN newspapers as n ON n.id = iss.newspaper_id
     GROUP BY n.id`, {
    type: sequelizeClient.QueryTypes.SELECT,
  }).then((results) => {
    results.forEach((d) => {
      newspapers[d.uid].firstIssue = new Issue({ uid: d.firstIssue });
      newspapers[d.uid].lastIssue = new Issue({ uid: d.lastIssue });
      newspapers[d.uid].countIssues = d.countIssues;
    });
  }).catch((err) => {
    console.log(err);
  });

  debug('saving', Object.keys(newspapers).length, 'newspapers...');

  fs.writeFileSync('./src/data/newspapers.json', JSON.stringify(newspapers));
  debug('success, saved ./src/data/newspapers.js');
  debug('count newspaper issues, pages');
}

waterfall().then(() => {
  debug('done, exit.'); // prints 60 after 2 seconds.
  process.exit();
}).catch((err) => {
  console.log(err);
  process.exit();
});
