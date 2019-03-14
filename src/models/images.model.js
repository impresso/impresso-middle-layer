class Image {
  constructor({
    uid = '',
  } = {}) {
    this.uid = String(uid);
  }

  /**
   * Return an Image mapper for Solr response document
   *
   * @return {function} {Image} image instance.
   */
  static solrFactory() {
    return (doc) => {
      const img = new Image({
        uid: doc.id,
        // newspaper: new Newspaper({
        //   uid: doc.meta_journal_s,
        // }),
      });
      return img;
    };
  }
}

module.exports = Image;
module.exports.SOLR_FL = ['id'];
