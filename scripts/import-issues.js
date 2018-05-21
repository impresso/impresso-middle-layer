const {merge, count, apoc} = require('./bulk');
const debug = require('debug')('impresso/scripts:import-issues');

debug('start!');
async function waterfall() {
  debug('merging issues...');
  const merging = await merge('issues', (item) => {
    const date = item.uid.match(/[A-Z]{3,}\-(\d{4}\-\d{2}\-\d{2})/)
    return {
      uid: item.uid,
      year: item.year,
      date: date[1],
      newspaper_uid: item.newspaper_uid
    }
  }, 500);
  debug('merge issues done.');
  debug('setting count ...');

  await count('issues');
  await apoc('issues', 'APOC_set_newspaper__count_issues');
}

waterfall().then(res => {
  debug('done, exit.');  // prints 60 after 2 seconds.
  process.exit();
}).catch(err => {
  console.log(err);
  process.exit();
});
