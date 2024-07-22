import { default as feathersConfiguration } from '@feathersjs/configuration'
import type { FromSchema, JSONSchemaDefinition } from '@feathersjs/schema'
import { Ajv, getValidator } from '@feathersjs/schema'
import type { RedisClientOptions } from 'redis'
import type { RateLimiterConfiguration } from './services/internal/rateLimiter/redis'
import { Sequelize } from 'sequelize'
import { CeleryClient } from './celery'
import { AuthenticationConfiguration } from '@feathersjs/authentication'

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

export interface SolrConfiguration {
  host: string
  port: number
  auth: {
    user: string
    pass: string
  }
  search: {
    alias: string
    endpoint: string
  }
  mentions: {
    alias: string
    endpoint: string
  }
  topics: {
    alias: string
    endpoint: string
  }
  images: {
    alias: string
    endpoint: string
  }
  entities: {
    alias: string
    endpoint: string
  }
}

export interface SequelizeConfiguration {
  alias?: string
  dialect: string
  host: string
  port: number
  auth: {
    user: string
    pass: string
  }
  database: string
  logging?: boolean
  tables?: {
    articles: string
    pages: string
    newspapers: string
    users: string
  }
}

export interface FeaturesConfiguration {
  textReuse: {
    enabled: boolean
  }
}

export interface LocalAuthenticationConfiguration extends AuthenticationConfiguration {
  jwtOptions: {
    issuer: string
  }
}

export interface Configuration {
  isPublicApi?: boolean
  allowedCorsOrigins?: string[]
  redis?: RedisConfiguration
  rateLimiter?: RateLimiterConfiguration & { enabled?: boolean }
  publicApiPrefix?: string
  useDbUserInRequestContext?: boolean
  problemUriBase?: string
  features?: FeaturesConfiguration
  // TODO: move to services:
  authentication: LocalAuthenticationConfiguration
  sequelize: SequelizeConfiguration
  sequelizeClient?: Sequelize
  celery?: CeleryConfiguration
  celeryClient?: CeleryClient
  media?: MediaConfiguration
  solr: SolrConfiguration
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
    solr: {
      type: 'object',
      properties: {
        host: { type: 'string', description: 'Solr host' },
        port: { type: 'number', description: 'Solr port' },
        auth: {
          type: 'object',
          properties: {
            user: { type: 'string', description: 'Solr user' },
            pass: { type: 'string', description: 'Solr password' },
          },
          required: ['user', 'pass'],
        },
      },
      description: 'Solr configuration',
      required: ['host', 'port', 'auth'],
    },
    sequelize: {
      type: 'object',
      properties: {
        alias: { type: 'string', description: 'Alias for the Sequelize instance' },
        dialect: { type: 'string', description: 'Dialect of the database' },
        host: { type: 'string', description: 'Host of the database' },
        port: { type: 'number', description: 'Port of the database' },
        auth: {
          type: 'object',
          properties: {
            user: { type: 'string', description: 'Database user' },
            pass: { type: 'string', description: 'Database password' },
          },
          required: ['user', 'pass'],
        },
        database: { type: 'string', description: 'Database name' },
        logging: { type: 'boolean', description: 'Enable logging' },
        tables: {
          type: 'object',
          properties: {
            articles: { type: 'string', description: 'Name of the articles table' },
            pages: { type: 'string', description: 'Name of the pages table' },
            newspapers: { type: 'string', description: 'Name of the newspapers table' },
            users: { type: 'string', description: 'Name of the users table' },
          },
          required: ['articles', 'pages', 'newspapers', 'users'],
        },
      },
      description: 'Sequelize configuration',
      required: ['dialect', 'host', 'port', 'auth', 'database'],
    },
  },
} as const

export type ConfigurationType = FromSchema<typeof configurationSchema>

const configurationValidator = getValidator(configurationSchema, new Ajv())

export default function configuration() {
  return feathersConfiguration(configurationValidator)
}
