import { default as feathersConfiguration } from '@feathersjs/configuration'
import { Ajv, getValidator } from '@feathersjs/schema'
import { Cache } from './cache'
import type { RedisClientOptions } from 'redis'

import { AuthenticationConfiguration } from '@feathersjs/authentication'
import { Sequelize } from 'sequelize'
import { CeleryClient } from './celery'
import type { CeleryConfig, Config, RedisConfig, SolrServerProxy } from './models/generated/common'
import { ImpressoApplication } from './types'

const ajv = new Ajv()
const configurationSchema = require('./schema/common/config.json')
ajv.addSchema(require('./schema/common/solrConfiguration.json'), 'solrConfiguration.json')

type RedisConfiguration = RedisConfig & RedisClientOptions

export type { CeleryConfig, RedisConfiguration, SolrServerProxy }

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
  availablePlans: string[]
}

const configurationValidator = getValidator(configurationSchema, ajv)

export default function configuration(app: ImpressoApplication) {
  return app.configure(feathersConfiguration(configurationValidator))
}
