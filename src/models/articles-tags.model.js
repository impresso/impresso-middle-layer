class ArticleTag {
  constructor({
    articleUid = '',
    tagUid = '',
    creationDate = new Date(),
    lastModifiedDate = new Date(),
  } = {}) {
    this.articleUid = String(articleUid);
    this.tagUid = String(tagUid);

    if (creationDate instanceof Date) {
      this.creationDate = creationDate;
    } else {
      this.creationDate = new Date(creationDate);
    }

    if (lastModifiedDate instanceof Date) {
      this.lastModifiedDate = lastModifiedDate;
    } else {
      this.lastModifiedDate = new Date(lastModifiedDate);
    }
  }
}

module.exports = function (params) {
  return new ArticleTag(params);
};

module.exports.Model = ArticleTag;
