// import tags from a well defined list of tags
const debug = require('debug')('impresso/scripts:import-tags');
const tags = require('./tags');
const slugify = require('slugify');
const shash = require('short-hash');
const { query, count } = require('./bulk');

debug('start!');

async function waterfall() {
  debug('merging tags...');

  await query('tags', 'merge', tags.map((d) => {
    // generate uuid from source
    d.slug = slugify(d.name);
    d.provider_code = d.provider_code || shash(d.name);
    d.uid = `${d.provider}-${d.provider_code}`;
    d.Project = 'impresso';
    return d;
  }));

  debug('merge tags done.');
  debug('SET project count_tags ...');

  await count('tags');
  debug('SET project count_tags done.');
}

waterfall().then((res) => {
  debug('done, exit.'); // prints 60 after 2 seconds.
  process.exit();
}).catch((err) => {
  console.log(err);
  process.exit();
});
