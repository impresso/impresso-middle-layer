// import tags from a well defined list of tags
const fs = require('fs');
const lodash = require('lodash');
const debug = require('debug')('impresso/scripts:update-data');
const config = require('@feathersjs/configuration')()();
const sequelizeClient = require('../src/sequelize').client(config.sequelize);
const solrClient = require('../src/solr').client(config.solr);
const Newspaper = require(`../src/models/newspapers.model`);
const Topic = require(`../src/models/topics.model`);


debug('start!');

async function waterfall() {
  debug('find newspapers...');

  const newspapers = await Newspaper.sequelize(sequelizeClient).scope('all').findAll()
    .then(results => results.map(d => d.toJSON()))
    .then(results => lodash.keyBy(results, 'acronym'));

  // pages per newspaper per year
  sequelizeClient.query(
    `SELECT COUNT(p.id) as count, iss.year, n.id FROM impresso_dev.pages p
    JOIN impresso_dev.issues as iss ON iss.id = p.issue_id
    JOIN impresso_dev.newspapers as n ON n.id = p.newspaper_id
    GROUP BY iss.year, n.id LIMIT 1000;`, {
    type: sequelizeClient.QueryTypes.SELECT,
  }).then(res => {
    console.log(res);
  }).catch(err => {
    console.log(err);
  });


  debug('saving', Object.keys(newspapers).length, 'newspapers...');



  fs.writeFileSync('./src/data/newspapers.json', JSON.stringify(newspapers));
  debug('success, saved ./src/data/newspapers.js');


  debug('count newspaper issues, pages');


}

waterfall().then((res) => {
  debug('done, exit.'); // prints 60 after 2 seconds.
  process.exit();
}).catch((err) => {
  console.log(err);
  process.exit();
});
