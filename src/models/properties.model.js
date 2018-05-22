// solr schema here.
// const Solr = require('feathers-solr')
// See http://docs.sequelizejs.com/en/latest/docs/models-definition/
// for more of what you can do here.
const Sequelize = require('sequelize');

const model = (client, options = {}) => {
  const prop = client.define('prop', {
    id:{
      type: Sequelize.INTEGER,
      primaryKey: true,
      unique: true,
    },
    prefix: {
      type: Sequelize.CHAR,
      length: 4,
      allowNull: false,
    },
    name:{
      type: Sequelize.STRING,
      unique: true,
    },
  }, {
    tableName: 'meta_properties',
    ... options,
  });

  // language.associate = function()
  // page.associate = function (models) { // eslint-disable-line no-unused-vars
  //   // Define associations here
  //   // See http://docs.sequelizejs.com/en/latest/docs/associations/
  //   // page.hasOne(Issue, { foreignKey: 'issue_id' });
  //   page.hasOne(Newspaper, { foreignKey: 'language_id' });
  // };

  return prop;
}

module.exports = function (app) {
  const config = app.get('sequelize');
  const prop = model(app.get('sequelizeClient'), {
    tableName: config.tables.properties || 'meta_properties',
    hooks: {
      beforeCount(options) {
        options.raw = true;
      }
    }
  });

  return {
    sequelize: prop
  };
};

module.exports.model = model
