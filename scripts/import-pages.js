const {merge} = require('./bulk');
const debug = require('debug')('impresso/scripts:import-pages');

debug('start!');
merge('pages', (item) => {
  return {
    'uid': item.uid,
    'page_number': item.page_number,
    'issue_uid': item.issue_uid
  }
}).then(res => {
  debug('done, exit.');  // prints 60 after 2 seconds.
  process.exit();
}).catch(err => {
  console.log(err);
  process.exit();
});
