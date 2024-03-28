import type { Application } from '@feathersjs/feathers';
import type { Configuration } from './configuration';
import { JSONSchema } from 'json-schema-to-ts';

export type ImpressoApplication = Application<{}, Configuration>;

export interface QueryParameter {
  in: 'query';
  name: string;
  required: boolean;
  schema: JSONSchema;
  description: string;
}
