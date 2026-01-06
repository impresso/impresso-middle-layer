import { Ajv, getValidator, JSONSchemaDefinition } from '@feathersjs/schema'
import { Cache } from '@/cache.js'
import type { RedisClientOptions } from 'redis'
import { AuthenticationConfiguration } from '@feathersjs/authentication'
import { Sequelize } from 'sequelize'
import { CeleryClient } from '@/celery.js'
import type { CeleryConfig, Config, RedisConfig, SolrServerProxy } from '@/models/generated/common.js'
import { ImpressoApplication } from '@/types.js'
import { feathersConfigurationLoader } from '@/util/configuration.js'

const ajv = new Ajv()
import configurationSchema from '@/schema/common/config.json' with { type: 'json' }
import solrConfigurationSchema from '@/schema/common/solrConfiguration.json' with { type: 'json' }
ajv.addSchema(solrConfigurationSchema, 'solrConfiguration.json')

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

const configurationValidator = getValidator(configurationSchema as any as JSONSchemaDefinition, ajv)

export default function configuration(app: ImpressoApplication) {
  return app.configure(feathersConfigurationLoader(configurationValidator))
}
