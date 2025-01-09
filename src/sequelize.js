import { logger } from './logger'
const debug = require('debug')('impresso/sequelize')
const verbose = require('debug')('verbose:impresso/sequelize')

const Sequelize = require('sequelize')

const defaultPoolConfig = {
  max: 30,
  min: 1,
  idle: 10000,
  evict: 30000,
}

const getSequelizeClient = config =>
  new Sequelize({
    host: config.host,
    port: config.port,
    database: config.database,
    username: config.auth.user,
    password: config.auth.pass,
    dialect: config.dialect,

    pool: config.pool ?? defaultPoolConfig,

    // do not look for dummy created_at or updated_at
    define: {
      timestamps: false,
    },
    // define: {
    //   freezeTableName: true
    // }
    logging(str) {
      verbose('cursor:', config.host, config.port, config.database)
      verbose(str)
    },
  })

export default function (app) {
  const config = app.get('sequelize')
  const sequelize = getSequelizeClient(config)
  debug(`Sequelize ${config.dialect} database name: ${config.database} ..`)
  // const oldSetup = app.setup;
  // test connection
  sequelize
    .authenticate()
    .then(() => {
      logger.info(
        `DB connection has been established successfully to a "${config.dialect}" database: ${config.database} on ${config.host}:${config.port}`
      )
    })
    .catch(err => {
      debug(`Unable to connect to the ${config.dialect}: ${config.database}: ${err}`)
    })

  app.set('sequelizeClient', sequelize)
}

export const client = getSequelizeClient
