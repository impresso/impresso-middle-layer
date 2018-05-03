const Sequelize = require('sequelize');
const Issue = require('issue');

module.exports = function (app) {
  const config = app.get('sequelize');
  const page = sequelizeClient.define('page', {
    

    id:{
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },

    // page number
    number:{
      type: Sequelize.SMALLINT
    },
  }

  page.associate = function (models) { // eslint-disable-line no-unused-vars
    // Define associations here
    // See http://docs.sequelizejs.com/en/latest/docs/associations/
    page.hasOne(Issue, { foreignKey: 'issue_id' });
  };

  return {
    sequelize: issue
  };
};
