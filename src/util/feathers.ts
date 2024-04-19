import { defaultServiceMethods } from '@feathersjs/feathers';

type T = any;

/**
 * A workaround for FeathersJS services (https://feathersjs.com/api/services)
 * If the service does not have at least one of the default methods - Feathers
 * will attempt to treat it as an Express middleware, which will cause an error.
 */
export const ensureServiceIsFeathersCompatible = (service: T): T => {
  const hasAnyMethods = defaultServiceMethods.some(name => service && typeof service[name] === 'function');
  if (!hasAnyMethods) {
    (service as any).get = function () {};
  }
  return service;
};
