import { default as feathersConfiguration } from '@feathersjs/configuration'
import { Ajv, getValidator } from '@feathersjs/schema'
import { Cache } from './cache'
import type { RedisClientOptions } from 'redis'

import { AuthenticationConfiguration } from '@feathersjs/authentication'
import { Sequelize } from 'sequelize'
import { CeleryClient } from './celery'
import type { CeleryConfig, Config, RedisConfig, SocksProxyConfig } from './models/generated/common'
import { ImpressoApplication } from './types'

const configurationSchema = require('./schema/common/config.json')

type RedisConfiguration = RedisConfig & RedisClientOptions

export type { CeleryConfig, RedisConfiguration, SocksProxyConfig }

export interface LocalAuthenticationConfiguration extends AuthenticationConfiguration {
  jwtOptions: {
    issuer: string
    audience: string
  }
}

export interface Configuration extends Config {
  // TODO: move to services:
  sequelizeClient?: Sequelize
  celeryClient?: CeleryClient
  cacheManager: Cache
  openApiValidatorMiddlewares: any[]
}

const configurationValidator = getValidator(configurationSchema, new Ajv())

export default function configuration(app: ImpressoApplication) {
  return app.configure(feathersConfiguration(configurationValidator))
}
