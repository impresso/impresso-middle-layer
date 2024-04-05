import type { HookContext, NextFunction } from '@feathersjs/feathers';
import type { ImpressoApplication } from '../types';
import { TooManyRequests } from '@feathersjs/errors';
import { logger } from '../logger';

export const DefaultResource = 'default';

/**
 * Hook that rate limits requests based on the user id and resource.
 * Requires the rateLimiter service to be available. If it's not - the
 * hook does nothing.
 *
 * @param resource - string tag of the resource to rate limit.
 */
export const rateLimit =
  (resource: string) => async (context: HookContext<ImpressoApplication>, next: NextFunction) => {
    const rateLimiter = context.app.service('rateLimiter');
    if (rateLimiter == null) return next();

    const userId: string = context.params?.user?.uid;
    if (userId == null) {
      logger.warn('Cannot rate limit unauthenticated request');
      return next();
    }

    const allowed = await rateLimiter.allow(userId, resource);
    if (!allowed) {
      throw new TooManyRequests('Rate limit exceeded');
    }
  };

/**
 * Hook that reverts the previous rate limit call in case of a 5XX error or
 * an unexpected error.
 * @param resource - string tag of the resource to rate limit.
 */
export const rollbackRateLimit =
  (resource: string) => async (context: HookContext<ImpressoApplication>, next: NextFunction) => {
    // Only roll back for unexpected server errors.
    console.log('oo', context.error);
    const errorCode: number | undefined = context.error?.code;
    if (context.error != null && errorCode != null && errorCode < 500) return next();

    const rateLimiter = context.app.service('rateLimiter');
    if (rateLimiter == null) return next();

    const userId: string = context.params?.user?.uid;
    if (userId == null) {
      logger.warn('Cannot rollback rate limit for unauthenticated requests');
      return next();
    }

    await rateLimiter.undo(userId, resource);
    console.log('Rolled back');
  };
