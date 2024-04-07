import type { Application } from '@feathersjs/feathers';
import type { JSONSchema } from 'json-schema-to-ts';
import type { Configuration } from './configuration';
import type { IRateLimiter } from './services/internal/rateLimiter/redis';
import type { IRedisClientContainer } from './redis';

interface AppServices {
  redisClient?: IRedisClientContainer;
  rateLimiter?: IRateLimiter;
}

export type ImpressoApplication = Application<AppServices, Configuration>;

export interface QueryParameter {
  in: 'query';
  name: string;
  required: boolean;
  schema: JSONSchema;
  description: string;
}
