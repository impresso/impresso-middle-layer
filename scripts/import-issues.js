const {merge} = require('./bulk');
const debug = require('debug')('impresso/scripts:import-issues');

debug('start!');
merge('issues', (item) => {
  // get day date out of uids. This way we validate uids
  const date = item.uid.match(/[A-Z]{3,}\-(\d{4}\-\d{2}\-\d{2})/)
  return {
    uid: item.uid,
    year: item.year,
    date: date[1],
    newspaper_uid: item.newspaper_uid
  }
}, 500).then(res => {
  debug('done, exit.');  // prints 60 after 2 seconds.
  process.exit();
}).catch(err => {
  console.log(err);
  process.exit();
});
