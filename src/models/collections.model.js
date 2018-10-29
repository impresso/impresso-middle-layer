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
    this.creationDate = creationDate instanceof Date ? creationDate : new Date(creationDate);
    this.lastModifiedDate = lastModifiedDate instanceof Date ? lastModifiedDate : new Date(lastModifiedDate);
    if (complete) {
      // TODO: fill
    }
  }
}

module.exports = function () { //app) {
  // const config = app.get('sequelize');
  // const issue = model(app.get('sequelizeClient'), {});
  //
  // return {
  //   sequelize: issue,
  // };
};

// module.exports.model = model;
module.exports.Model = Collection;
