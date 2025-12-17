import { Ajv, getValidator, JSONSchemaDefinition } from '@feathersjs/schema'
import { Cache } from './cache'
import type { RedisClientOptions } from 'redis'
import type { ContentItem as ContentItemPublic } from './models/generated/schemasPublic'
import { AuthenticationConfiguration } from '@feathersjs/authentication'
import { Sequelize } from 'sequelize'
import { CeleryClient } from './celery'
import type { CeleryConfig, Config, RedisConfig, SolrServerProxy } from './models/generated/common'
import { ImpressoApplication } from './types'
import { feathersConfigurationLoader } from './util/configuration'

const ajv = new Ajv()
import configurationSchema from './schema/common/config.json'
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
  exportedFieldsForContentItems: (keyof ContentItemPublic)[]
}

const configurationValidator = getValidator(configurationSchema as any as JSONSchemaDefinition, ajv)

export default function configuration(app: ImpressoApplication) {
  return app.configure(feathersConfigurationLoader(configurationValidator))
}
