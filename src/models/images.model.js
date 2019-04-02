const Page = require('./pages.model');
const Issue = require('./issues.model');
const Newspaper = require('./newspapers.model');

class Image {
  constructor({
    uid = '',
    type = 'image',
    coords = [],
    issue = new Issue(),
    newspaper = new Newspaper(),
    date = new Date(),
    year = 0,
    isFront = false,
    pages = [],
  } = {}) {
    this.uid = String(uid);
    this.year = parseInt(year, 10);
    this.type = String(type);
    this.coords = coords;
    this.pages = pages;
    this.isFront = Boolean(isFront);
    this.regions = pages.map(page => ({
      pageUid: page.uid,
      coords,
    }));

    if (date instanceof Date) {
      this.date = date;
    } else {
      this.date = new Date(date);
    }
    if (newspaper instanceof Newspaper) {
      this.newspaper = newspaper;
    } else {
      this.newspaper = new Newspaper(newspaper);
    }
    if (issue instanceof Issue) {
      this.issue = issue;
    } else {
      this.issue = new Issue(issue);
    }
  }

  /**
   * Return an Image mapper for Solr response document
   *
   * @return {function} {Image} image instance.
   */
  static solrFactory() {
    return (doc) => {
      console.log(doc);
      const img = new Image({
        uid: doc.id,
        newspaper: new Newspaper({
          uid: doc.meta_journal_s,
        }),
        issue: new Issue({
          uid: doc.meta_issue_id_s,
        }),
        pages: Array.isArray(doc.page_nb_is) ? doc.page_nb_is.map(num => new Page({
          uid: `${doc.meta_issue_id_s}-p${String(num).padStart(4, '0')}`,
          num,
        })) : [],
        type: doc.item_type_s,
        year: doc.meta_year_i,
        date: doc.meta_date_dt,
        coords: doc.iiif_box,
        isFront: doc.front_b,
      });
      return img;
    };
  }
}

module.exports = Image;
module.exports.SOLR_FL = [
  'id',
  'meta_ed_s',
  'meta_issue_id_s',
  'page_nb_is',
  'meta_year_i',
  'linked_art_s',
  'meta_month_i',
  'front_b',
  'meta_day_i',
  'meta_journal_s',
  'meta_date_dt',
  'item_type_s',
  '_version_',
];
