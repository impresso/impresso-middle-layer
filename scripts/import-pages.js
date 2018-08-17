const { merge, count, apoc } = require('./bulk');
const debug = require('debug')('impresso/scripts:import-pages');

debug('start!');
async function waterfall() {
  debug('merging pages...');
  const merging = await merge('pages', item => ({
    uid: item.uid,
    page_number: item.page_number,
    issue_uid: item.issue_uid,
  }), 500);
  debug('merge pages done.');
  debug('setting count ...');

  await count('pages');
  await apoc('pages', 'APOC_set_issue__count_pages');
  await apoc('pages', 'APOC_set_newspaper__count_pages');
}

waterfall().then((res) => {
  debug('done, exit.'); // prints 60 after 2 seconds.
  process.exit();
}).catch((err) => {
  console.log(err);
  process.exit();
});
