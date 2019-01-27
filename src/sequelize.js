const debug = require('debug')('impresso/sequelize');
const verbose = require('debug')('verbose:impresso/sequelize');

const Sequelize = require('sequelize');

const { Op } = Sequelize;
const operatorsAliases = {
  $eq: Op.eq,
  $ne: Op.ne,
  $gte: Op.gte,
  $gt: Op.gt,
  $lte: Op.lte,
  $lt: Op.lt,
  $not: Op.not,
  $in: Op.in,
  $notIn: Op.notIn,
  $is: Op.is,
  $like: Op.like,
  $notLike: Op.notLike,
  $iLike: Op.iLike,
  $notILike: Op.notILike,
  $regexp: Op.regexp,
  $notRegexp: Op.notRegexp,
  $iRegexp: Op.iRegexp,
  $notIRegexp: Op.notIRegexp,
  $between: Op.between,
  $notBetween: Op.notBetween,
  $overlap: Op.overlap,
  $contains: Op.contains,
  $contained: Op.contained,
  $adjacent: Op.adjacent,
  $strictLeft: Op.strictLeft,
  $strictRight: Op.strictRight,
  $noExtendRight: Op.noExtendRight,
  $noExtendLeft: Op.noExtendLeft,
  $and: Op.and,
  $or: Op.or,
  $any: Op.any,
  $all: Op.all,
  $values: Op.values,
  $col: Op.col,
};

const getSequelizeClient = config => new Sequelize({
  host: config.host,
  port: config.port,
  database: config.database,
  username: config.auth.user,
  password: config.auth.pass,
  dialect: config.dialect,

  operatorsAliases,

  // do not look for dummy created_at or updated_at
  define: {
    timestamps: false,
  },
  // define: {
  //   freezeTableName: true
  // }
  logging(str) {
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
