// solr schema here.
// const Solr = require('feathers-solr')
// See http://docs.sequelizejs.com/en/latest/docs/models-definition/
// for more of what you can do here.
const Sequelize = require('sequelize');

const model = (client, options = {}) => {
  const newspaper = client.define('newspaper', {
    uid:{
      type: Sequelize.STRING,
      primaryKey: true,
      unique: true,
      field: 'id',
    },
    title: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    start_year:{
      type: Sequelize.SMALLINT,
    },
    end_year:{
      type: Sequelize.SMALLINT,
    },
  }, {
    ... options,
  });

  // newspaper.associate = function()
  // page.associate = function (models) { // eslint-disable-line no-unused-vars
  //   // Define associations here
  //   // See http://docs.sequelizejs.com/en/latest/docs/associations/
  //   // page.hasOne(Issue, { foreignKey: 'issue_id' });
  //   page.hasOne(Newspaper, { foreignKey: 'newspaper_id' });
  // };

  return newspaper;
}

module.exports = function (app) {
  const config = app.get('sequelize');
  const newspaper = model(app.get('sequelizeClient'), {
    tableName: config.tables.newspapers,
    hooks: {
      beforeCount(options) {
        options.raw = true;
      }
    }
  });

  return {
    sequelize: newspaper
  };
};

module.exports.model = model
