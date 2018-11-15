class Tag {
  constructor({
    uid = '',
    name = '',
    labels = ['bucket', 'tag'],
    creationDate = new Date(),
    lastModifiedDate = new Date(),
    articles = [],
  } = {}, complete = false) {
    this.uid = String(uid);
    this.labels = labels;
    this.name = String(name);

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

    if (complete) {
      this.articles = articles;
    }
  }
}

module.exports = function () { // app) {
  // const config = app.get('sequelize');
  // const issue = model(app.get('sequelizeClient'), {});
  //
  // return {
  //   sequelize: issue,
  // };
};

// module.exports.model = model;
module.exports.Model = Tag;
