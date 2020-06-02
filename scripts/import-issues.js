const {
  query, count, apoc, config,
} = require('./bulk');

const debug = require('debug')('impresso/scripts:import-issues');
const solr = require('../src/solr').client(config.solr, config.solrConnectionPool);
const Eta = require('node-eta');


debug('start!');
async function waterfall() {
  debug('merging issues...');
  const limit = 100;
  const consumed = 0;

  let _solr = await solr.findAll({
    q: '*:*',
    fl: 'id',
    limit: 1,
    skip: 0,
    group_by: 'meta_issue_id_s',
  });

  const total = _solr.response.numFound;
  const steps = Math.ceil(total / limit);
  const eta = new Eta(steps - consumed, true);

  for (let i = consumed; i < steps; i++) {
    _solr = await solr.findAll({
      q: '*:*',
      fl: 'id,meta_issue_id_s,meta_year_i',
      limit,
      skip: i * limit,
      group_by: 'meta_issue_id_s',
    });
    const issues = _solr.response.docs.map((d) => {
      const parts = d.groupValue.match(/^([A-Z]{3,})\-(\d{4}\-\d{2}\-\d{2})/);
      return {
        uid: d.groupValue,
        year: d.doclist.docs[0].meta_year_i,
        count_articles: d.doclist.numFound,
        date: parts[2],
        newspaper_uid: parts[1],
      }
    });

    // use cypher
    await query('issues', 'merge', issues, limit);
    eta.iterate();
    debug(`import step ${i} / ${steps} completed, eta ${eta.format('{{etah}}')}!`);

  }
    //
    // await query('issues', 'merge', _solr.response.docs.map((group) => {
    //   console.log(pageUid, pageUid.match(/-p0+(\d+)$/)[1]);
    //   // console.log(pageUid.match(/^([a-zA-Z\d-]+)-p0+(\d+)$/)[1]);
    //   return {
    //     uid: pageUid,
    //     page_number: pageUid.match(/-p0+(\d+)$/)[1],
    //     issue_uid: pageUid.match(/^([a-zA-Z\d-]+)-p0+(\d+)$/)[1],
    //   };
    // }), limit);
  // const merging = await merge('issues', (item) => {
  //   const date = item.uid.match(/[A-Z]{3,}\-(\d{4}\-\d{2}\-\d{2})/);
  //   return {
  //     uid: item.uid,
  //     year: item.year,
  //     date: date[1],
  //     newspaper_uid: item.newspaper_uid,
  //   };
  // }, 500);
  // debug('merge issues done.');
  // debug('setting count ...');
  //
  // await count('issues');
  // await apoc('issues', 'APOC_set_newspaper__count_issues');
}

waterfall().then((res) => {
  debug('done, exit.'); // prints 60 after 2 seconds.
  process.exit();
}).catch((err) => {
  console.log(err);
  process.exit();
});
