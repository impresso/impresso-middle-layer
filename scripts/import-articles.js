const {merge, count, apoc} = require('./bulk');
const debug = require('debug')('impresso/scripts:import-articles');

debug('start!');
async function waterfall() {
  debug('merging articles...');
  debug('merge articles done.');
  debug('calling APOC_set_issue__count_articles ...');
  await apoc('articles', 'APOC_set_issue__count_articles');
  debug('APOC_set_issue__count_articles done.');
  debug('calling APOC_set_newspaper__count_articles ...');
  await apoc('articles', 'APOC_set_newspaper__count_articles');
  debug('APOC_set_newspaper__count_articles done.');

}

waterfall().then(res => {
  debug('done, exit.');  // prints 60 after 2 seconds.
  process.exit();
}).catch(err => {
  console.log(err);
  process.exit();
});
