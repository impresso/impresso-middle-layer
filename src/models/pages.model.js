const Sequelize = require('sequelize');
const Newspaper = require('./newspapers.model').model;
const Issue = require('./issues.model').model;

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

module.exports = function (app) {
  // const config = app.get('sequelize');
  const page = model(app.get('sequelizeClient'), {
    // tableName: config.tables.pages,
    hooks: {
      beforeCount(options) {
        options.raw = true;
      },
    },
  });


  return {
    sequelize: page,
  };
};

module.exports.model = model;
