import { hooks } from '@feathersjs/authentication'
import { NotAuthenticated } from '@feathersjs/errors'
import type { HookContext, NextFunction } from '@feathersjs/feathers'
import type { ImpressoApplication } from '../types'
/**
 * A wrapper around authenticate hook from featherjs
 * to enabe allowUnauthenticate again ...
 */

interface Options {
  allowUnauthenticated?: boolean
}

/**
 * @deprecated - use authenticateAround instead
 */
export const authenticate =
  (strategy = 'jwt', { allowUnauthenticated = false }: Options = {}) =>
  (context: HookContext<ImpressoApplication>) =>
    hooks
      .authenticate(strategy)(context)
      .catch((err: Error) => {
        // swallow error if it's a non-auth error and we allow unauthenticated
        if (err instanceof NotAuthenticated && allowUnauthenticated) {
          // swallow
        }
        throw err
      })

interface AuthenticateAroundOptions {
  strategy?: string
  allowUnauthenticated?: boolean
}

/**
 * Use this in "around" hooks to authenticate the user before the
 * around rate limiting hoook is called.
 * @param strategy - authentication strategy to use
 * @param allowUnauthenticated - allow unauthenticated requests
 * (NOTE: this flag is ignored when the application is running in the public API mode)
 */
export const authenticateAround =
  ({ strategy = 'jwt', allowUnauthenticated = false }: AuthenticateAroundOptions = {}) =>
  async (context: HookContext<ImpressoApplication>, next: NextFunction) => {
    const isPublicApi = context.app.get('isPublicApi')
    // only allow unauthenticated in non-public API
    const doAllowUnauthenticated = isPublicApi ? false : allowUnauthenticated

    await authenticate(strategy, { allowUnauthenticated: doAllowUnauthenticated })(context)
    await next()
  }
