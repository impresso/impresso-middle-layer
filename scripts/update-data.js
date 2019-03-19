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
  debug('saving', Object.keys(newspapers).length, 'newspapers...');

  fs.writeFileSync('./src/data/newspapers.json', JSON.stringify(newspapers));
  debug('success, saved ./src/data/newspapers.js');

  debug('find topics...');
  const topics = await solrClient.findAll({
    q: `*:*`,
    limit: 1000,
    skip: 0,
    fl: '*',
    namespace: 'topics',
  }, Topic.solrFactory)
    .then((result) => {
      debug(`${result.response.numFound} topics found in ${result.responseHeader.QTime} ms`);
      return result.response.docs;
    })
    .then(results => lodash.keyBy(results, 'uid'));

  debug('saving', Object.keys(topics).length, 'topics...');

  fs.writeFileSync('./src/data/topics.json', JSON.stringify(topics));
  debug('success, saved ./src/data/topics.js');

}

waterfall().then((res) => {
  debug('done, exit.'); // prints 60 after 2 seconds.
  process.exit();
}).catch((err) => {
  console.log(err);
  process.exit();
});
