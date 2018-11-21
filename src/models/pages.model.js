const Sequelize = require('sequelize');
const Newspaper = require('./newspapers.model').model;
const Issue = require('./issues.model').model;


class Page {
  constructor({
    iiif = '',
    labels = ['page'],
    num = 0,

    // number of articles
    countArticles = 0,

    // entities = [],
    // tags = [],
    // collections = [],
    uid = '',
  } = {}, complete = false) {
    this.uid = String(uid);

    // if default is 0, then get page number from uid
    if (num === 0) {
      this.num = this.uid.match(/p0*([0-9]+)$/)[1];
    } else {
      this.num = parseInt(num, 10);
    }
    // if any is provided
    this.iiif = String(iiif);
    this.labels = labels;
    this.countArticles = parseInt(countArticles, 10);
    if (complete) {
      // // TODO:
    }
  }
}

const model = (client, options = {}) => {
  const newspaper = Newspaper(client);
  const issue = Issue(client);
  const page = client.define('page', {
    uid: {
      type: Sequelize.STRING,
      primaryKey: true,
      field: 'id',
      unique: true,
    },
    issue_uid: {
      type: Sequelize.STRING,
      field: 'issue_id',
    },
    newspaper_uid: {
      type: Sequelize.STRING,
      field: 'newspaper_id',
    },
    page_number: {
      type: Sequelize.SMALLINT,
      field: 'page_number',
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
          {
            model: issue,
            as: 'issue',
          },
        ],
      },
    },
  });

  page.belongsTo(newspaper, {
    foreignKey: 'newspaper_id',
  });

  page.belongsTo(issue, {
    foreignKey: 'issue_id',
  });
  // page.associate = function (models) { // eslint-disable-line no-unused-vars
  //   // Define associations here
  //   // See http://docs.sequelizejs.com/en/latest/docs/associations/
  //   // page.hasOne(Issue, { foreignKey: 'issue_id' });
  //
  // };

  return page;
};

module.exports = function () {
  // // const config = app.get('sequelize');
  // const page = model(app.get('sequelizeClient'), {
  //   // tableName: config.tables.pages,
  //   hooks: {
  //     beforeCount(options) {
  //       options.raw = true;
  //     },
  //   },
  // });
  //
  //
  // return {
  //   sequelize: page,
  // };
};

module.exports.model = model;
module.exports.Model = Page;
