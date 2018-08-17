const {
  query, count, apoc, config,
} = require('./bulk');
const debug = require('debug')('impresso/scripts:import-articles');
const fs = require('fs');
const _ = require('lodash');
const _groupby = require('lodash/groupby');
const _map = require('lodash/map');
const solr = require('../src/solr').client(config.solr);


debug('start! \'__dirname\':', __dirname);
async function waterfall() {
  // load first 1000 ids directly from solr.
  //
  const limit = 100;
  let _solr = await solr.findAll({
    q: '*:*',
    fl: 'id',
    limit: 1,
    skip: 0,
  });

  const total = _solr.response.numFound;
  const steps = Math.ceil(total / limit);

  for (let i = 0; i < steps; i++) {
    _solr = await solr.findAll({
      q: '*:*',
      fl: 'id,page_id_ss,page_nb_is,meta_journal_s,meta_year_i,meta_month_i,lg_s,meta_date_dt,title_txt_fr,content_txt_fr',
      limit,
      skip: i * limit,
    });

    const pagesUids = _(_solr.response.docs)
      .map('pages')
      .flatten().uniq()
      .value();

    console.log(pagesUids);

    // add missing pages. Longer but safer.
    await query('pages', 'merge', pagesUids.map((pageUid) => {
      console.log(pageUid, pageUid.match(/-p0+(\d+)$/)[1]);
      // console.log(pageUid.match(/^([a-zA-Z\d-]+)-p0+(\d+)$/)[1]);
      return {
        uid: pageUid,
        page_number: pageUid.match(/-p0+(\d+)$/)[1],
        issue_uid: pageUid.match(/^([a-zA-Z\d-]+)-p0+(\d+)$/)[1],
      };
    }), limit);

    // create pages if they do not exist!
    // _solr.response.docs.map(


    await query('articles', 'merge', _solr.response.docs.map((d) => {
      d.date = d.uid.match(/\d{4}-\d{2}-\d{2}/)[0];
      d.page__uids = d.pages;
      d.newspaper__uid = d.newspaper_uid;
      d.regions = [];
      d.Project = 'impresso';
      console.log(d.uid);
      return d;
    }), limit);

    debug(`'waterfall': start:${_solr.responseHeader.params.start}, rows:${_solr.responseHeader.params.rows}, numFound:${_solr.response.numFound}`);
  }
  // console.log(_solr.response.numFound);
  //
  // for( let doc of _solr.response.docs ){
  //   console.log(doc)
  // }

  // foreach loop awaiting
  // for (let file of files) {
  //   const contents = await fs.readFile(file, 'utf8');
  //   console.log(contents);
  // }

  //
  // const page = JSON.parse(fs.readFileSync(`${__dirname}/__pages/GDL-1811-11-22-a-p0001.json`, 'utf8'));
  // // console.log(page);
  //
  // // import artuckes for this page
  // // group regiosn by pOf
  // const articles = _groupby(page.r, 'pOf');
  // console.log(articles);
  //
  // debug('merging articles...');
  // await query('articles', 'merge', _map(articles, (sections, uid) => {
  //   const regions = sections.reduce((acc, value) => {
  //     console.log(value)
  //     return acc.concat(value.c)
  //   }, []);
  //   // console.log(regions)
  //   // const paragraphs = sections.reduce((acc, value) => acc.concat(value.p[0].l[0].c), []);
  //   // get page id
  //   return {
  //     page__uid: 'GDL-1811-11-22-a-p0001',
  //     newspaper__uid: 'GDL',
  //     date: '1811-11-22',
  //     regions,
  //     uid,
  //   }
  // }), limit = 100);
  //
  // debug('merge articles done.');
  // debug('calling APOC_set_issue__count_articles ...');
  // await apoc('articles', 'APOC_set_issue__count_articles');
  // debug('APOC_set_issue__count_articles done.');
  // debug('calling APOC_set_newspaper__count_articles ...');
  // await apoc('articles', 'APOC_set_newspaper__count_articles');
  // debug('APOC_set_newspaper__count_articles done.');
  // await apoc('pages', 'APOC_set_issue__count_pages');
  // debug('APOC_set_issue__count_pages done.');
  // await apoc('pages', 'APOC_set_newspaper__count_pages');
  // debug('APOC_set_newspaper__count_pages done.');
}

waterfall().then((res) => {
  debug('done, exit.'); // prints 60 after 2 seconds.
  process.exit();
}).catch((err) => {
  console.log(err);
  process.exit();
});
