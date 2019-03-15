const truncatise = require('truncatise');
const { DataTypes } = require('sequelize');
const config = require('@feathersjs/configuration')()();

const Newspaper = require('./newspapers.model');
const Collection = require('./collections.model');
const CollectableItem = require('./collectable-items.model');
const Issue = require('./issues.model');
const Page = require('./pages.model');
const ArticleTopic = require('./articles-topics.model');

const {
  toHierarchy, sliceAtSplitpoints, render, annotate,
} = require('../helpers');

const ARTICLE_SOLR_FL_MINIMAL = [
  'id',
  'item_type_s',
  'doc_type_s',
];

const ARTICLE_SOLR_FL_LITE = [
  'id',
  'lg_s', // 'fr',
  'content_txt_fr',
  'title_txt_fr',
  'content_txt_en',
  'title_txt_en',
  'content_txt_de',
  'title_txt_de',

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

const ARTICLE_SOLR_FL_TO_CSV = [
  'id',
  'lg_s', // 'fr',

  'title_txt_fr',
  'title_txt_en',
  'title_txt_de',
  // coordinates ok
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
  'topics_dpfs',
];

const ARTICLE_SOLR_FL_SEARCH = ARTICLE_SOLR_FL_LITE.concat([
  'pp_plain:[json]',
]);

const ARTICLE_SOLR_FL = ARTICLE_SOLR_FL_LITE.concat([
  'lb_plain:[json]',
  'rb_plain:[json]',
  'pp_plain:[json]',
  'nem_offset_plain:[json]',
  'topics_dpfs',
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
    issue = new Issue(),
    // labels = [],

    newspaper = new Newspaper(),

    pages = [],
    // regions = [],
    collections = [],
    tags = [],
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
    // mentions offsets
    mentions = [],
    // topics
    topics = [],
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
        TruncateBy: 'words',
        TruncateLength: 50,
      });
    } else {
      this.excerpt = '';
    }

    this.size = parseInt(size, 10);

    this.issue = issue;
    this.newspaper = newspaper;
    // this.issue =
    this.pages = pages;
    this.collections = collections;
    this.tags = tags;

    this.country = String(country);
    this.year = parseInt(year, 10);
    this.date = date instanceof Date ? date : new Date(date);

    // stats
    this.nbPages = parseInt(nbPages, 10);
    this.isFront = !!isFront;
    this.isCC = !!isCC;

    // TODO: based on type!
    this.labels = ['article'];

    if (mentions.length) {
      this.mentions = mentions;
    }

    if (topics.length) {
      this.topics = topics;
    }
    this.enrich(rc, lb, rb);
  }

  toCSV() {
    return {
      uid: this.uid,
      title: this.title,
      content: this.content,
      language: this.language,
      labels: this.labels.join(','),
      year: this.year,
      date: this.date.toISOString(),
      size: this.size,
      isFront: this.isFront,
      nbPages: this.nbPages,
      pages: this.pages.map(d => d.uid).join(','),
      issue: this.issue.uid,
      newspaper: this.newspaper.uid,
      country: this.country,
    };
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

      // annotated wit mentions...
      if (this.mentions && this.mentions.length) {
        this.mentions.filter(d => d !== null).forEach((group) => {
          const category = Object.keys(group)[0];
          group[category].forEach((token) => {
            annotate(tokens, category, token[0], token[0] + token[1], 'class');
          });
        });
      }

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
    //
  }

  /**
   * get regions from pp_plain field, aka region coordinates.
   * Te param `regionCoords` is a list of page objects, containing a r property
   * which contains an array of coordinates [x,y,w,h]
   * this reduce function returns something like:
   *  const regions = [
   *    { page_uid: 'GDL-1900-08-08-a-p0002',
   *      c: [ 3433, 1440, 783, 42 ] },
   *    { page_uid: 'GDL-1900-08-08-a-p0002',
   *      c: [ 3433, 1481, 783, 571 ] }
   *  ][getPageRegions description]
   * @param  {Array}  regionCoords=[]
   * @return {Array}  List of ArticleRegion
   */
  static getRegions({
    regionCoords = [],
  }) {
    return regionCoords.reduce((acc, pag) => acc.concat(pag.r.map(reg => new ArticleRegion({
      pageUid: pag.id,
      c: reg,
    }))), []);
  }

  /**
   * Given a solr document containing pp_plain, it
   * merges info coming from SOLR select api to create
   * ArticleMatch instances
   *
   * @param  {Object} solrDocument    [description]
   * @param  {Array}  [fragments=[]]  [description]
   * @param  {Object} [highlights={}] [description]
   * @return {Array}                 Array of ArticleMatch matches
   */
  static getMatches({
    solrDocument,
    fragments = [],
    highlights = {},
  } = {}) {
    if (!highlights || !highlights.offsets) {
      return [];
    }
    return highlights.offsets.map((pos, i) => {
      // for each offset
      let match = false;
      // find in page
      solrDocument.pp_plain.forEach((pag) => {
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
    }).filter(d => d);
  }

  static sequelize(client) {
    const newspaper = Newspaper.sequelize(client);
    const page = Page.sequelize(client);
    const collection = Collection.sequelize(client);
    const collectableItem = CollectableItem.sequelize(client);

    const article = client.define('article', {
      uid: {
        type: DataTypes.STRING(50),
        primaryKey: true,
        field: 'id',
        unique: true,
      },
      v: {
        type: DataTypes.STRING(50),
        field: 's3_version',
      },
      creationDate: {
        type: DataTypes.DATE,
        field: 'created',
      },
    }, {
      tableName: config.sequelize.tables.articles,
      scopes: {
        get: {
          include: [
            {
              model: newspaper,
              as: 'newspaper',
            },
            {
              model: page,
              as: 'pages',
            },
          ],
        },
        getCollections: {
          include: [
            {
              model: collection,
              as: 'collections',
            },
          ],
        },
      },
    });

    article.prototype.toJSON = function () {
      return new Article({
        ...this.get(),
        newspaper: this.newspaper ? this.newspaper.toJSON() : null,
        pages: this.pages ? this.pages.map(p => p.toJSON()) : [],
      });
    };

    article.belongsTo(newspaper, {
      foreignKey: {
        fieldName: 'newspaper_id',
      },
    });

    article.belongsToMany(collection, {
      as: 'collections',
      through: collectableItem,
      foreignKey: 'item_id',
      otherKey: 'collection_id',
    });

    article.belongsToMany(page, {
      as: 'pages',
      through: 'page_contentItem',
      foreignKey: 'page_id',
      otherKey: 'content_item_id',
    });

    return article;
  }

  /**
   * Return an Article mapper for Solr response document
   *
   * @param {Object} res Solr response object
   * @return {function} {Article} mapper with a single doc.
   */
  static solrFactory(res) {
    return (doc) => {
      const art = new Article({
        uid: doc.id,
        type: doc.item_type_s,
        language: doc.lg_s,

        title: doc[`title_txt_${doc.lg_s}`],
        content: doc[`content_txt_${doc.lg_s}`],
        size: doc.content_length_i,

        newspaper: new Newspaper({
          uid: doc.meta_journal_s,
        }),
        issue: new Issue({
          uid: doc.meta_issue_id_s,
        }),

        country: doc.meta_country_code_s,
        year: doc.meta_year_i,
        date: new Date(doc.meta_date_dt),
        pages: Array.isArray(doc.page_id_ss) ? doc.page_id_ss.map((d, i) => new Page({
          uid: d,
          num: doc.page_nb_is[i],
        })) : [],
        nbPages: doc.nb_pages_i,
        // front_b
        isFront: doc.front_b,
        // has reliable coordinates force as boolean
        isCC: !!doc.cc_b,

        lb: doc.lb_plain,
        rb: doc.rb_plain,

        rc: doc.pp_plain,

        mentions: doc.nem_offset_plain,
        topics: ArticleTopic.solrDPFsFactory(doc.topics_dpfs),
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
      if (!highlights) {
        return art;
      }

      art.matches = Article.getMatches({
        article: art,
        solrDocument: doc,
        fragments,
        highlights,
      });


      return art;
    };
  }
}

// module.exports.SequelizeFactory = model;
module.exports = Article;
module.exports.solrFactory = Article.solrFactory;
module.exports.Model = Article;
module.exports.ARTICLE_SOLR_FL = ARTICLE_SOLR_FL;
module.exports.ARTICLE_SOLR_FL_LITE = ARTICLE_SOLR_FL_LITE;
module.exports.ARTICLE_SOLR_FL_SEARCH = ARTICLE_SOLR_FL_SEARCH;
module.exports.ARTICLE_SOLR_FL_TO_CSV = ARTICLE_SOLR_FL_TO_CSV;
module.exports.ARTICLE_SOLR_FL_MINIMAL = ARTICLE_SOLR_FL_MINIMAL;
