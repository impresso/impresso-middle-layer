const Page = require('./pages.model');
const Newspaper = require('./newspapers.model');

class Image {
  constructor({
    uid = '',
    coords = [],
    newspaper = new Newspaper(),
    year = 0,
    date = new Date(),
    pages = [],
  } = {}) {
    this.uid = String(uid);
    this.year = parseInt(year, 10);
    this.coords = coords;
    this.pages = pages;
    this.regions = pages.map((page) => ({
      pageUid: page.uid,
      coords: coords,
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
          uid: doc.newspaper[0],
        }),
        year: doc.year[0],
        coords: doc.iiif_box,
        pages: doc.iiif_base_url.map((d) => new Page({
          uid: d.split('/').pop(),
        })),
      });
      return img;
    };
  }
}

module.exports = Image;
module.exports.SOLR_FL = ['id'];
