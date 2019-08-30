const { DataTypes } = require('sequelize');
const lodash = require('lodash');
const config = require('@feathersjs/configuration')()();

const Newspaper = require('./newspapers.model');
const Collection = require('./collections.model');
const CollectableItem = require('./collectable-items.model');
const Issue = require('./issues.model');
const Page = require('./pages.model');
const ArticleTopic = require('./articles-topics.model');

const {
  toHierarchy, sliceAtSplitpoints, render, annotate, toExcerpt,
} = require('../helpers');

const { getExternalFragment } = require('../hooks/iiif');

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

  'topics_dpfs',
  'pers_entities_dpfs',
  'loc_entities_dpfs',
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
  'pers_entities_dpfs',
  'loc_entities_dpfs',
];

const ARTICLE_SOLR_FL_SEARCH = ARTICLE_SOLR_FL_LITE.concat([
  'pp_plain:[json]',
]);

const ARTICLE_SOLR_FL = ARTICLE_SOLR_FL_LITE.concat([
  'lb_plain:[json]',
  'rb_plain:[json]',
  'pp_plain:[json]',
  'nem_offset_plain:[json]',
]);

class ArticleDPF {
  constructor({
    uid = '',
    relevance = '',
  } = {}) {
    this.uid = uid;
    this.relevance = parseFloat(relevance);
  }

  static solrDPFsFactory(dpfs) {
    if (!dpfs || !dpfs.length) {
      return [];
    }
    // console.log('solrDPFsFactory', dpfs);
    // dpfs = [ 'aida-0001-54-Paris|1 aida-0001-54-Pleven|1 aida-0001-54-Maurice_Bowra|1 aida-0001-54-China|1 aida-0001-54-Moscow|1 ' ]
    return dpfs[0].trim().split(' ').map((d) => {
      const parts = d.split('|');
      return new ArticleDPF({
        uid: parts[0],
        relevance: parts[1],
      });
    });
  }
}

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

class BaseArticle{
  constructor({
    uid = '',
    type = '',
    title = '',
    content = '',
    excerpt = '',
    isCC = false,
    size = 0,
    pages = [],
    persons = [],
    locations = [],
    collections = [],
  } = {}) {
    this.uid = String(uid);
    this.type = String(type);
    this.title = String(title);
    this.size = parseInt(size, 10);
    this.nbPages = pages.length;
    this.pages = pages;
    this.isCC = isCC;
    this.excerpt = toExcerpt(excerpt, {
      TruncateLength: 20,
      excludeTitle: this.title,
    });
    if (collections.length) {
      this.collections = collections;
    }
    if (persons.length) {
      this.persons = persons;
    }
    if (locations.length) {
      this.locations = locations;
    }
  }
  /**
   * Return an Article mapper for Solr response document
   *
   * @param {Object} res Solr response object
   * @return {function} {Article} mapper with a single doc.
   */
  static solrFactory(res) {
    const fragments = res.fragments || {};
    return (doc) => new BaseArticle({
      uid: doc.id,
      type: doc.item_type_s,
      size: doc.content_length_i,
      pages: doc.page_id_ss.map(uid => ({
        uid,
        num: parseInt(uid.match(/p([0-9]+)$/)[1], 10),
      })),
      isCC: !!doc.cc_b,
      title: Article.getUncertainField(doc, 'title'),
      persons: ArticleDPF.solrDPFsFactory(doc.pers_entities_dpfs),
      locations: ArticleDPF.solrDPFsFactory(doc.loc_entities_dpfs),
      collections: doc.ucoll_ss,
      excerpt: lodash.get(fragments[doc.id], 'nd[0]', ''),
    });
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
    issue = null,
    // labels = [],

    newspaper = null,

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
    // entities: person
    persons = [],
    locations = [],
  } = {}) {
    this.uid = String(uid);
    this.type = String(type);
    this.language = String(language);

    this.title = String(title);
    this.content = String(content);

    if (excerpt) {
      this.excerpt = String(excerpt);
    } else if (this.content.length) {
      this.excerpt = toExcerpt(this.content, {
        TruncateLength: 20,
        excludeTitle: this.title,
      });
    } else {
      this.excerpt = '';
    }

    this.size = parseInt(size, 10);

    if (issue instanceof Issue) {
      this.issue = issue;
    } else if (issue) {
      this.issue = new Issue({ uid: issue });
    }
    if (newspaper instanceof Newspaper) {
      this.newspaper = newspaper;
    } else {
      this.newspaper = new Newspaper({ uid: newspaper });
    }
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

    if (persons.length) {
      this.persons = persons;
    }

    if (locations.length) {
      this.locations = locations;
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

    // if there are line breaks and region breaks ...
    if (this.content.length) {
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

  assignIIIF(props = ['regions', 'matches']) {
    // get iiif of pages
    const pagesIndex = lodash.keyBy(this.pages, 'uid'); // d => d.iiif);
    props.forEach((prop) => {
      if (Array.isArray(this[prop])) {
        this[prop].forEach((d, i) => {
          if (pagesIndex[this[prop][i].pageUid]) {
            this[prop][i].iiifFragment = getExternalFragment(pagesIndex[this[prop][i].pageUid].iiif, {
              coords: d.coords,
            });
          }
        });
      }
    });
  }

  static assignIIIF(article, props = ['regions', 'matches']) {
    // get iiif of pages
    const pagesIndex = lodash.keyBy(article.pages, 'uid'); // d => d.iiif);
    props.forEach((prop) => {
      if (Array.isArray(article[prop])) {
        article[prop].forEach((d, i) => {
          if (pagesIndex[article[prop][i].pageUid]) {
            article[prop][i].iiifFragment = getExternalFragment(pagesIndex[article[prop][i].pageUid].iiif, {
              coords: d.coords,
            });
          }
        });
      }
    });
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
        // newspaper: this.newspaper ? this.newspaper.toJSON() : null,
        // pages: this.pages ? this.pages.map(p => p.toJSON()) : [],
      });
    };

    // article.belongsTo(newspaper, {
    //   foreignKey: {
    //     fieldName: 'newspaper_id',
    //   },
    // });

    article.belongsToMany(collection, {
      as: 'collections',
      through: collectableItem,
      foreignKey: 'item_id',
      otherKey: 'collection_id',
    });

    article.belongsToMany(page, {
      as: 'pages',
      through: 'page_contentItem',
      foreignKey: 'content_item_id',
      otherKey: 'page_id',
    });

    return article;
  }

  /**
   * Given a solr document representing an article, return the value according to the field name
   * when the field is declined multilanguage (eg when you have content_txt_de or
   * content_txt_fr and you only care about some `content`)
   *
   * @param  {Object} doc   [description]
   * @param  {String} field field name, without the `_txt_<language>` suffix
   * @param  {Array}  langs =['fr', 'de', 'en'] Array of language suffixes
   * @return {String}       the field value
   */
  static getUncertainField(doc, field, langs = ['fr', 'de', 'en']) {
    let value = doc[`${field}_txt_${doc.lg_s}`];

    if (!value) {
      for (let i = 0, l = langs.length; i < l; i += 1) {
        value = doc[`${field}_txt_${langs[i]}`];
        if (value) {
          break;
        }
      }
    }
    return value;
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

        title: Article.getUncertainField(doc, 'title'),
        content: Article.getUncertainField(doc, 'content'),
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
        persons: ArticleDPF.solrDPFsFactory(doc.pers_entities_dpfs),
        locations: ArticleDPF.solrDPFsFactory(doc.loc_entities_dpfs),
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
module.exports.BaseArticle = BaseArticle;
module.exports.ARTICLE_SOLR_FL = ARTICLE_SOLR_FL;
module.exports.ARTICLE_SOLR_FL_LITE = ARTICLE_SOLR_FL_LITE;
module.exports.ARTICLE_SOLR_FL_SEARCH = ARTICLE_SOLR_FL_SEARCH;
module.exports.ARTICLE_SOLR_FL_TO_CSV = ARTICLE_SOLR_FL_TO_CSV;
module.exports.ARTICLE_SOLR_FL_MINIMAL = ARTICLE_SOLR_FL_MINIMAL;
