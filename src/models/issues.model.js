const Sequelize = require('sequelize');
const Newspaper = require('./newspapers.model');

const model = (client, options = {}) => {
  const newspaper = Newspaper.model(client);
  const issue = client.define('issue', {
    uid: {
      type: Sequelize.STRING,
      primaryKey: true,
      field: 'id',
      unique: true,
    },
    newspaper_uid: {
      type: Sequelize.STRING,
      field: 'newspaper_id',
    },
    year: {
      type: Sequelize.SMALLINT,
    },
    month: {
      type: Sequelize.SMALLINT,
    },
    day: {
      type: Sequelize.SMALLINT,
    },
  }, {
    ...options,
    scopes: {
      findAll: {
        include: [
          {
            model: newspaper,
            as: 'newspaper',
          },
        ],
      },
    },
  });

  issue.belongsTo(newspaper, {
    foreignKey: 'newspaper_id',
  });

  return issue;
};

class Issue {
  constructor({
    // collections = [],
    // countArticles = 0,
    // countPages = 0,
    // date = new Date(),
    // entities = [],
    // newspaper = new Newspaper.Model(),
    // pages = [],
    uid = '',
    // year = 0,
    labels = ['issue'],
  } = {}, complete = false) {
    this.uid = String(uid);
    this.labels = labels;
    if (complete) {
      // TODO: fill
    }
  }
}

module.exports = function (app) {
  // const config = app.get('sequelize');
  const issue = model(app.get('sequelizeClient'), {});

  return {
    sequelize: issue,
  };
};

module.exports.model = model;
module.exports.Model = Issue;
