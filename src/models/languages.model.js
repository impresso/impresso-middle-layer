// solr schema here.
// const Solr = require('feathers-solr')
// See http://docs.sequelizejs.com/en/latest/docs/models-definition/
// for more of what you can do here.
const Sequelize = require('sequelize');

const model = (client, options = {}) => {
  const language = client.define('language', {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      unique: true,
    },
    code: {
      type: Sequelize.CHAR,
      length: 2,
      allowNull: false,
    },
    uri: {
      type: Sequelize.STRING,
      field: 'lexvo_uri',
    },
  }, {
    ...options,
  });

  // language.associate = function()
  // page.associate = function (models) { // eslint-disable-line no-unused-vars
  //   // Define associations here
  //   // See http://docs.sequelizejs.com/en/latest/docs/associations/
  //   // page.hasOne(Issue, { foreignKey: 'issue_id' });
  //   page.hasOne(Newspaper, { foreignKey: 'language_id' });
  // };

  return language;
};

module.exports = function (app) {
  const config = app.get('sequelize');
  const language = model(app.get('sequelizeClient'), {
    tableName: config.tables.languages || 'languages',
    hooks: {
      beforeCount(options) {
        options.raw = true;
      },
    },
  });

  return {
    sequelize: language,
  };
};

module.exports.model = model;
