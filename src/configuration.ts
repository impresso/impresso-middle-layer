import { default as feathersConfiguration } from '@feathersjs/configuration'
import type { FromSchema, JSONSchemaDefinition } from '@feathersjs/schema'
import { Ajv, getValidator } from '@feathersjs/schema'
import type { RedisClientOptions } from 'redis'
import type { RateLimiterConfiguration } from './services/internal/rateLimiter/redis'
import { Sequelize } from 'sequelize'
import { CeleryClient } from './celery'

export type RedisConfiguration = RedisClientOptions & { enable?: boolean; host?: string }

export interface CeleryConfiguration {
  enable?: boolean
  brokerUrl?: string
  backendUrl?: string
}

export interface MediaConfiguration {
  host: string
  path: string
  services: string[]
  protectedPath: string
}

export interface Configuration {
  isPublicApi?: boolean
  allowedCorsOrigins?: string[]
  redis?: RedisConfiguration
  rateLimiter?: RateLimiterConfiguration & { enabled?: boolean }
  publicApiPrefix?: string
  useDbUserInRequestContext?: boolean
  problemUriBase?: string

  // TODO: move to services:
  sequelizeClient?: Sequelize
  celery?: CeleryConfiguration
  celeryClient?: CeleryClient
  media?: MediaConfiguration
}

const configurationSchema: JSONSchemaDefinition = {
  $id: 'configuration',
  type: 'object',
  properties: {
    isPublicApi: { type: 'boolean', description: 'If `true`, the app serves a public API' },
    allowedCorsOrigins: {
      type: 'array',
      items: {
        type: 'string',
      },
      description: 'List of allowed origins for CORS',
    },
    redis: {
      type: 'object',
      properties: {
        enable: { type: 'boolean', description: 'Enable Redis' },
        brokerUrl: { type: 'string', description: 'URL of the Redis broker' },
      },
      description: 'Redis configuration',
    },
    rateLimiter: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean', description: 'Enable rate limiter' },
        capacity: { type: 'number', description: 'Capacity of the rate limiter' },
        refillRate: { type: 'number', description: 'Refill rate of the rate limiter' },
      },
      description: 'Rate limiter configuration',
      required: ['capacity', 'refillRate'],
    },
    publicApiPrefix: { type: 'string', description: 'Prefix for the public API' },
    useDbUserInRequestContext: {
      type: 'boolean',
      description:
        'If `true`, the user object is loaded from the db on every request. ' +
        'If `false` (default), the user object is created from the JWT token',
    },
    problemUriBase: {
      type: 'string',
      description:
        'Base URI for problem URIs. Falls back to the default URI (https://impresso-project.ch/probs) if not set',
    },
  },
} as const

export type ConfigurationType = FromSchema<typeof configurationSchema>

const configurationValidator = getValidator(configurationSchema, new Ajv())

export default function configuration() {
  return feathersConfiguration(configurationValidator)
}
