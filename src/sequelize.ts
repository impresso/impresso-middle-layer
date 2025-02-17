import { logger } from './logger'
import Debug from 'debug'
import { Sequelize, Options, Dialect } from 'sequelize'
import { SequelizeConfig } from './models/generated/common'
import { ImpressoApplication } from './types'

const verbose = Debug('verbose:impresso/sequelize')
const debug = Debug('impresso/sequelize')

const defaultPoolConfig = {
  max: 30,
  min: 1,
  idle: 10000,
  evict: 30000,
}

const getSequelizeClient = (config: SequelizeConfig) => {
  return new Sequelize({
    host: config.host,
    port: config.port,
    database: config.database,
    username: config.auth.user,
    password: config.auth.pass,
    dialect: config.dialect as Dialect,

    dialectOptions: {
      supportBigNumbers: true,
      ssl: {
        require: true,
        // NOTE: the new DB fails this test, likely because it's
        // accessed via a SSH tunnel.
        // Since we trust the tunnel, we can disable this check.
        rejectUnauthorized: false, // Disables SSL/TLS certificate verification
      },
      connectTimeout: 300000,
    },

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
  } satisfies Options)
}

export default function (app: ImpressoApplication) {
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
      logger.error(`Unable to connect to the ${config.dialect}: ${config.database}: ${err}`)
    })

  app.set('sequelizeClient', sequelize)
}

export const client = getSequelizeClient
