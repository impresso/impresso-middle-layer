const { merge, count } = require('./bulk');
const debug = require('debug')('impresso/scripts:import-newspapers');

debug('start!');
async function waterfall() {
  debug('merging newspapers...');
  const savenewspapers = await merge('newspapers', item => ({
    uid: item.uid,
    acronym: item.uid,
    name: item.title,
    start_year: item.start_year,
    end_year: item.end_year,
    delta_year: item.end_year - item.start_year,
    languages: item.languages.map(d => d.code),
  }), 500);
  debug('merge newspapers done.');
  debug('setting count ...');
  const savecount = await count('newspapers');
}

waterfall().then((res) => {
  debug('done, exit.'); // prints 60 after 2 seconds.
  process.exit();
}).catch((err) => {
  console.log(err);
  process.exit();
});
