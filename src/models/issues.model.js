const Sequelize = require('sequelize');
const Newspaper = require('./newspapers.model');

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

  static sequelize(client) {
    const newspaper = Newspaper.sequelize(client);
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
  }
}


module.exports = Issue;
