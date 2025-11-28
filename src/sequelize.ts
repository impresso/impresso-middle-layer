import { logger } from './logger'
import Debug from 'debug'
import { Sequelize, Options, Dialect } from 'sequelize'
import { SequelizeConfig, SolrServerProxy } from './models/generated/common'
import { ImpressoApplication } from './types'
import { ConnectionOptions } from 'mysql2'
import SocksConnection from './util/socks'
import { getSocksProxyConfiguration, shouldUseSocksProxy } from './util/socksProxyConfiguration'
import { associateModels, initializeModels } from './models'

const verbose = Debug('verbose:impresso/sequelize')
const debug = Debug('impresso/sequelize')

const defaultPoolConfig = {
  max: 30,
  min: 1,
  idle: 10000,
  evict: 30000,
}

const getSequelizeClient = (config: SequelizeConfig) => {
  const socksProxyOptions = getSocksProxyConfiguration()

  const streamGetter = shouldUseSocksProxy(config.host, socksProxyOptions)
    ? () => {
        logger.info(
          `Using SOCKS proxy (${socksProxyOptions?.host}:${socksProxyOptions?.port}) for a new DB connection to ${config.host}`
        )

        return new SocksConnection(
          {
            host: config.host,
            port: config.port,
            rejectUnauthorized: false,
          },
          {
            host: socksProxyOptions?.host!,
            port: socksProxyOptions?.port!,
          }
        )
      }
    : undefined

  const client = new Sequelize({
    host: config.host,
    port: config.port,
    database: config.database,
    username: config.auth.user,
    password: config.auth.pass,
    dialect: config.dialect as Dialect,

    dialectOptions: {
      supportBigNumbers: true,
      ssl: {
        // NOTE: the new DB fails this test, likely because it's
        // accessed via a SSH tunnel.
        // Since we trust the tunnel, we can disable this check.
        rejectUnauthorized: false, // Disables SSL/TLS certificate verification
      },
      connectTimeout: 300000,
      stream: streamGetter,
    } satisfies ConnectionOptions,

    pool: config.pool ?? defaultPoolConfig,

    // do not look for dummy created_at or updated_at
    define: {
      timestamps: false,
    },
    // define: {
    //   freezeTableName: true
    // }

    retry: {
      max: 5, // Maximum retry attempts
      backoffBase: 1000, // Initial backoff in milliseconds (1 second)
      backoffExponent: 1.5, // Exponential backoff factor
    },

    logging(str) {
      verbose('cursor:', config.host, config.port, config.database)
      verbose(str)
    },
  } satisfies Options)

  return { client }
}

export default async function (app: ImpressoApplication) {
  const config = app.get('sequelize')

  const { client } = getSequelizeClient(config)

  debug(`Sequelize ${config.dialect} database name: ${config.database} ..`)
  // const oldSetup = app.setup;
  // test connection
  await client
    .authenticate()
    .then(() => {
      logger.info(
        `DB connection has been established successfully to a "${config.dialect}" database: ${config.database} on ${config.host}:${config.port}`
      )
    })
    .catch(err => {
      logger.error(`Unable to connect to the ${config.dialect}: ${config.database}: ${err}`)
      throw err
    })

  // Initialize all models
  initializeModels(client)
  logger.info('All models initialized successfully')

  // Set up associations
  associateModels(client)
  logger.info('All model associations set up successfully')
  // # initialize models here, only when initialize does not contain any association
  // to be improved later

  app.set('sequelizeClient', client)
}
