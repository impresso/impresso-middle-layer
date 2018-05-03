// solr schema here.
// const Solr = require('feathers-solr')
// See http://docs.sequelizejs.com/en/latest/docs/models-definition/
// for more of what you can do here.
const Sequelize = require('sequelize');

module.exports = function (app) {
  const sequelizeClient = app.get('sequelizeClient');
  const config = app.get('sequelize');
  const newspaper = sequelizeClient.define('newspaper', {
    id:{
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    title: {
      type: Sequelize.STRING,
      allowNull: false,
      unique: true,
    },
    full_title: {
      type: Sequelize.STRING,
      allowNull: true
    },
    start_year:{
      type: Sequelize.SMALLINT
    },
    end_year:{
      type: Sequelize.SMALLINT
    },
    country_code:{
      type: Sequelize.CHAR
    },
    province_code:{
      type: Sequelize.CHAR
    },
  }, {
    tableName: config.tables.newspapers,
    hooks: {
      beforeCount(options) {
        options.raw = true;
      }
    }
  });

  newspaper.associate = function (models) { // eslint-disable-line no-unused-vars
    // Define associations here
    // See http://docs.sequelizejs.com/en/latest/docs/associations/
  };

  return {
    sequelize: newspaper
  };
};
