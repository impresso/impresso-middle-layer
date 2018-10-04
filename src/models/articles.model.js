// const Sequelize = require('sequelize');
// const Newspaper = require('./newspapers.model').model;
//
// const model = (client, options = {}) => {
//   const newspaper = Newspaper(client);
//   const issue = client.define('issue', {
//     uid: {
//       type: Sequelize.STRING,
//       primaryKey: true,
//       field: 'id',
//       unique: true,
//     },
//     newspaper_uid: {
//       type: Sequelize.STRING,
//       field: 'newspaper_id',
//     },
//     year: {
//       type: Sequelize.SMALLINT,
//     },
//     month: {
//       type: Sequelize.SMALLINT,
//     },
//     day: {
//       type: Sequelize.SMALLINT,
//     },
//   }, {
//     ...options,
//     scopes: {
//       findAll: {
//         include: [
//           {
//             model: newspaper,
//             as: 'newspaper',
//           },
//         ],
//       },
//     },
//   });
//
//   issue.belongsTo(newspaper, {
//     foreignKey: 'newspaper_id',
//   });
//
//   return issue;
// };


const truncatise = require('truncatise');
const Newspaper = require('./newspapers.model');
const Issue = require('./issues.model');
const Page = require('./pages.model');
const {
  toHierarchy, sliceAtSplitpoints, render,
} = require('../helpers');

const ARTICLE_SOLR_FL_LITE = [
  'id',
  'lg_s', // 'fr',
  'content_txt_fr',
  'title_txt_fr',
  // coordinates ok
  'cc_b',
  'front_b',
  'page_id_ss',
  'page_nb_is',
  'item_type_s',
  // 'page_nb_pagei'
  'nb_pages_i',
  'doc_type_s',

  'meta_journal_s', // 'GDL',
  'meta_year_i', // 1900,
  'meta_date_dt', // '1900-08-09T00:00:00Z',
  'meta_issue_id_s', // 'GDL-1900-08-09-a',
  'meta_country_code_s', // 'CH',
  'meta_province_code_s', // 'VD',
  'content_length_i',
];

const ARTICLE_SOLR_FL_SEARCH = ARTICLE_SOLR_FL_LITE.concat([
  'pp_plain:[json]',
]);

const ARTICLE_SOLR_FL = ARTICLE_SOLR_FL_LITE.concat([
  'lb_plain:[json]',
  'rb_plain:[json]',
  'pp_plain:[json]',
]);

class ArticleRegion {
  constructor({
    pageUid = '',
    g = [],
    c = [],
  } = {}) {
    this.pageUid = String(pageUid);
    this.coords = c;
    if (g.length) {
      this.g = render(g);
    }
  }
}

class ArticleMatch {
  constructor({
    coords = [],
    fragment = '',
    pageUid = '',
    iiif = '',
  } = {}) {
    this.coords = coords.map(coord => parseInt(coord, 10));
    this.fragment = String(fragment);
    this.pageUid = String(pageUid);
    this.iiif = String(iiif);
  }
}

class Article {
  constructor({
    uid = '',
    type = '',
    language = '',
    title = '',
    excerpt = '',
    content = '',
    size = 0,
    // dl = 0,
    issue = new Issue.Model(),
    // labels = [],

    newspaper = new Newspaper.Model(),
    //

    pages = [],
    // regions = [],
    // collections = [],
    // tags = [],
    // matches = [],
    // time = 0,

    // uid = '',
    country = '',
    year = 0,
    date = new Date(),

    // other stats
    nbPages = 0,
    isFront = false,
    isCC = false,

    // line breaks
    lb = [],
    // region breaks
    rb = [],
    // region coordinates
    rc = [],
  } = {}) {
    this.uid = String(uid);
    this.type = String(type);
    this.language = String(language);

    this.title = String(title);
    this.content = String(content);

    if (excerpt) {
      this.excerpt = String(excerpt);
    } else if (this.content.length) {
      this.excerpt = truncatise(this.content, {
        TruncateLength: 100,
      });
    } else {
      this.excerpt = '';
    }

    this.size = parseInt(size, 10);

    this.issue = issue;
    this.newspaper = newspaper;
    // this.issue =
    this.pages = pages;

    this.country = String(country);
    this.year = parseInt(year, 10);
    this.date = date instanceof Date ? date : new Date(date);

    // stats
    this.nbPages = parseInt(nbPages, 10);
    this.isFront = !!isFront;
    this.isCC = !!isCC;

    // TODO: based on type!
    this.labels = ['article'];
    this.enrich(rc, lb, rb);
  }

  enrich(rc, lb, rb) {
    // get regions from rc field:
    // rc is a list of page objects, containing a r property
    // which contains an array of coordinates [x,y,w,h]
    // this reduce function returns something like:
    //  const rcs = [
    //    { page_uid: 'GDL-1900-08-08-a-p0002',
    //      c: [ 3433, 1440, 783, 42 ] },
    //    { page_uid: 'GDL-1900-08-08-a-p0002',
    //      c: [ 3433, 1481, 783, 571 ] }
    //  ]
    const rcs = rc.reduce((acc, pag) => acc.concat(pag.r.map(reg => ({
      pageUid: pag.id,
      c: reg,
    }))), []);

    // if there are line brack and region breaks ...
    if (lb.length && rb.length && rc.length) {
      // tokenize the content based on line breaks
      const tokens = sliceAtSplitpoints(this.content, lb);
      // text regions, grouped thanks to region splipoints
      const trs = toHierarchy(tokens, rb);

      if (rcs.length !== trs.length) {
        // it would never happen.
        throw new Error(`article ${this.uid} coordinates corrupted`);
      }
      // then, for each region,
      // we add the corresponding regionCoords, if any
      // this.regions = this.regions.map()
      for (let i = 0, l = trs.length; i < l; i += 1) {
        Object.assign(trs[i], rcs[i]);
      }
      this.regions = trs.map(d => new ArticleRegion(d));
    } else {
      this.regions = rcs.map(d => new ArticleRegion(d));
    }
    // console.log(this.regions);
  }
  // static
}


/**
 * Return an Article mapper for Solr response document
 *
 * @param {Object} res Solr response object
 * @return {function} {Article} mapper with a single doc.
 */
const solrFactory = res => (doc) => {
  const art = new Article({
    uid: doc.id,
    type: doc.item_type_s,
    language: doc.lg_s,

    title: doc[`title_txt_${doc.lg_s}`],
    content: doc[`content_txt_${doc.lg_s}`],
    size: doc.content_length_i,

    newspaper: new Newspaper.Model({
      uid: doc.meta_journal_s,
    }),
    issue: new Issue.Model({
      uid: doc.meta_issue_id_s,
    }),

    country: doc.meta_country_code_s,
    year: doc.meta_year_i,
    date: new Date(doc.meta_date_dt),
    pages: doc.page_id_ss.map((d, i) => new Page.Model({
      uid: d,
      num: doc.page_nb_is[i],
    })),
    nbPages: doc.nb_pages_i,
    // front_b
    isFront: doc.front_b,
    // has reliable coordinates force as boolean
    isCC: !!doc.cc_b,

    lb: doc.lb_plain,
    rb: doc.rb_plain,

    rc: doc.pp_plain,
  });

  if (!doc.pp_plain) {
    return art;
  }
  // get text matches
  const fragments = res.fragments[art.uid][`content_txt_${art.language}`];
  const highlights = res.highlighting[art.uid][`content_txt_${art.language}`];
  //
  // console.log('fragments!!', res.fragments, '--', fragments);
  // console.log('highlights!!', res.highlighting, '--', highlights);
  // console.log(doc.pp_plain);

  art.matches = highlights.offsets.map((pos, i) => {
    // for each offset
    let match;
    // find in page
    doc.pp_plain.forEach((pag) => {
      for (let l = pag.t.length, ii = 0; ii < l; ii += 1) {
        // if the token start at position and the token length is
        // the one described in pos. Really complicated.
        if (pos[0] === pag.t[ii].s && pag.t[ii].l === pos[1] - pos[0]) {
          // console.log('FFFFOUND', pag.id, pag.t[ii], pos[0]);
          match = new ArticleMatch({
            fragment: fragments[i],
            coords: pag.t[ii].c,
            pageUid: pag.id,
          });
          break;
        }
      }
    });
    return match;
  });
  return art;
};

module.exports = function () { // function (app) {
  // // const config = app.get('sequelize');
  // const a = model(app.get('sequelizeClient'), {});
  //
  // return {
  //   sequelize: issue,
  //   solr: article,
  // };
};

// module.exports.SequelizeFactory = model;
module.exports.solrFactory = solrFactory;
module.exports.Model = Article;
module.exports.ARTICLE_SOLR_FL = ARTICLE_SOLR_FL;
module.exports.ARTICLE_SOLR_FL_LITE = ARTICLE_SOLR_FL_LITE;
module.exports.ARTICLE_SOLR_FL_SEARCH = ARTICLE_SOLR_FL_SEARCH;