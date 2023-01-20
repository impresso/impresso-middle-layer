class ArticleEntity {
  constructor ({
    articleUid = '',
    entityUid = '',
    frequence = 0,
  } = {}) {
    this.articleUid = String(articleUid);
    this.entityUid = String(entityUid);
    this.frequence = parseInt(frequence, 10);
  }
}

module.exports = function (params) {
  return new ArticleEntity(params);
};

module.exports.Model = ArticleEntity;
