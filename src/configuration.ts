import { Cache } from '@/cache.js'
import { CeleryClient } from '@/celery.js'
import type { CeleryConfig, Config, RedisConfig, SolrServerProxy } from '@/models/generated/app/configuration.js'
import configurationSchema from '@/schema/app/configuration/config.json' with { type: 'json' }
import solrConfigurationSchema from '@/schema/app/configuration/solrConfiguration.json' with { type: 'json' }
import { ImpressoApplication } from '@/types.js'
import { feathersConfigurationLoader } from '@/util/configuration.js'
import { AuthenticationConfiguration } from '@feathersjs/authentication'
import { getValidator, JSONSchemaDefinition } from '@feathersjs/schema'
import { Ajv2019 as Ajv } from 'ajv/dist/2019.js'
import type { RedisClientOptions } from 'redis'
import { Sequelize } from 'sequelize'

const ajv = new Ajv({
  coerceTypes: true,
  addUsedSchema: false,
})
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
