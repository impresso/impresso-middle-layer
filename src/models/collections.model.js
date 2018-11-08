class Collection {
  constructor({
    uid = '',
    name = '',
    description = '',
    labels = ['bucket'],
    creationDate = new Date(),
    lastModifiedDate = new Date(),
  } = {}, complete = false) {
    this.uid = String(uid);
    this.labels = labels;
    this.name = String(name);
    this.description = String(description);

    this.creationDate = creationDate instanceof Date ? creationDate : new Date(creationDate);

    if (lastModifiedDate instanceof Date) {
      this.lastModifiedDate = lastModifiedDate;
    } else {
      this.lastModifiedDate = new Date(lastModifiedDate);
    }

    if (complete) {
      // TODO: fill
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
module.exports.Model = Collection;
