import { default as feathersConfiguration } from '@feathersjs/configuration';
import type { FromSchema, JSONSchemaDefinition } from '@feathersjs/schema';
import { Ajv, getValidator } from '@feathersjs/schema';
import type { RedisClientOptions } from 'redis';
import type { RateLimiterConfiguration } from './services/internal/rateLimiter/redis';

export interface Configuration {
  isPublicApi?: boolean;
  allowedCorsOrigins?: string[];
  redis?: RedisClientOptions & { enable?: boolean };
  rateLimiter?: RateLimiterConfiguration & { enabled?: boolean };
}

const configurationSchema: JSONSchemaDefinition = {
  $id: 'configuration',
  type: 'object',
  properties: {
    isPublicApi: {
      type: 'boolean',
      description: 'If `true`, the app serves a public API',
    },
    allowedCorsOrigins: {
      type: 'array',
      items: {
        type: 'string',
      },
      description: 'List of allowed origins for CORS',
    },
  },
} as const;

export type ConfigurationType = FromSchema<typeof configurationSchema>;

const configurationValidator = getValidator(configurationSchema, new Ajv());

export default function configuration() {
  const x = feathersConfiguration(configurationValidator);
  return x;
}
