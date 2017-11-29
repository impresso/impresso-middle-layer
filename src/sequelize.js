require('dotenv').config();
const Sequelize = require('sequelize');

module.exports = function () {
  const app = this;
  const connectionString = `postgres://${process.env.PGNAME}:${process.env.PGPASS}@localhost:${process.env.PGPORT}/${process.env.PGNAME}`;
  const sequelize = new Sequelize(connectionString, {
    dialect: 'postgres',
    logging: false,
    define: {
      freezeTableName: true
    }
  });
  const oldSetup = app.setup;

  app.set('sequelizeClient', sequelize);

  app.setup = function (...args) {
    const result = oldSetup.apply(this, args);

    // Set up data relationships
    const models = sequelize.models;
    Object.keys(models).forEach(name => {
      if ('associate' in models[name]) {
        models[name].associate(models);
      }
    });

    // Sync to the database
    sequelize.sync();

    return result;
  };
};
