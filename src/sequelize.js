const debug = require('debug')('impresso/sequelize');
const verbose = require('debug')('verbose:impresso/sequelize');

const Sequelize = require('sequelize');

const getSequelizeClient = config => new Sequelize({
  host: config.host,
  port: config.port,
  database: config.database,
  username: config.auth.user,
  password: config.auth.pass,
  dialect: config.dialect,

  // do not look for dummy created_at or updated_at
  define: {
    timestamps: false,
  },
  // define: {
  //   freezeTableName: true
  // }
  logging (str) {
    verbose('cursor:', config.host, config.port, config.database);
    verbose(str);
  },
});

module.exports = function (app) {
  const config = app.get('sequelize');
  const sequelize = getSequelizeClient(config);
  debug(`Sequelize ${config.dialect} database name: ${config.database} ..`);
  // const oldSetup = app.setup;
  // test connection
  sequelize
    .authenticate()
    .then(() => {
      debug(`Sequelize is ready! ${config.dialect} database name: ${config.database}`);
    })
    .catch((err) => {
      debug(`Unable to connect to the ${config.dialect}: ${config.database}: ${err}`);
    });

  app.set('sequelizeClient', sequelize);
};

module.exports.client = getSequelizeClient;
