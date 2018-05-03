const Sequelize = require('sequelize');
const Newspaper = require('newspaper');

module.exports = function (app) {
  const config = app.get('sequelize');
  const issue = sequelizeClient.define('issue', {

  }

  issue.associate = function (models) { // eslint-disable-line no-unused-vars
    // Define associations here
    // See http://docs.sequelizejs.com/en/latest/docs/associations/
    issue.hasOne(Newspaper, { foreignKey: 'newspaper_id' });
  };

  return {
    sequelize: issue
  };
};
