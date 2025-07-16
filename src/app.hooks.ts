// Application hooks that run for every service
import Debug from 'debug'
import { ApplicationHookFunction, ApplicationHookOptions, HookContext } from '@feathersjs/feathers'
import { ValidationError } from 'ajv'
import { GeneralError, BadGateway, BadRequest, Unprocessable } from '@feathersjs/errors'
import { ImpressoApplication } from './types'
import { logger } from './logger'
const { authenticate } = require('@feathersjs/authentication').hooks

const debug = Debug('impresso/app.hooks')
// const { validateRouteId } = require('./hooks/params')
const { InvalidArgumentError } = require('./util/error')

const basicParams = () => (context: HookContext) => {
  // do nothing with internal services
  if (context.self.isInternalService) return

  if (!context.params) {
    context.params = {}
  }
  if (!context.params.query) {
    context.params.query = {}
  }
  ;['limit', 'page', 'offset'].forEach(param => {
    if (context.params.query[param]) {
      context.params.query[param] = parseInt(context.params.query[param], 10)
    }
  })
}

/**
 * Ensure JWT has been sent, except for the authentication andpoint.
 * @return {[type]} [description]
 */
// prettier-ignore
const requireAuthentication =
  ({
    excludePaths = ['authentication', 'users', 'newspapers'], //
  } = {}) => (context: HookContext) => {
    const allowUnauthenticated = excludePaths.indexOf(context.path) !== -1
    debug('hook:requireAuthentication', context.path, !allowUnauthenticated)
    if (!allowUnauthenticated) {
      return authenticate('jwt')(context)
    }
    return context
  }

const LoggingExcludedStatusCodesInternalApi = [401, 403, 404]
const LoggingExcludedStatusCodesPublicApi = [400, 401, 403, 404, 422]

const errorHandler = (ctx: HookContext<ImpressoApplication>) => {
  const excludedStatusCodes = ctx.app.get('isPublicApi')
    ? LoggingExcludedStatusCodesPublicApi
    : LoggingExcludedStatusCodesInternalApi

  if (ctx.error) {
    const error = ctx.error

    if (!excludedStatusCodes.includes(error.code) || !error.code) {
      logger.error(
        `ERROR ${error.code || error.type || 'N/A'} ${error.name} at ${ctx.path}:${ctx.method} - message:"${error.message}" - stack:`,
        error
      )
    }

    if (error instanceof ValidationError) {
      ctx.error = new Unprocessable(error.message, error.errors)
    } else if (error.name === 'SequelizeConnectionRefusedError') {
      ctx.error = new BadGateway('SequelizeConnectionRefusedError')
    } else if (error.name === 'SequelizeConnectionError') {
      ctx.error = new BadGateway('SequelizeConnectionError')
    } else if (error instanceof InvalidArgumentError) {
      ctx.error = new BadRequest(error)
    } else if (!error.code) {
      ctx.error = new GeneralError('server error')
    }
    if (error.code === 404 || process.env.NODE_ENV === 'production') {
      error.stack = null
    }
    return ctx
  }
  return ctx
}

export default (
  setupFunctions: ApplicationHookFunction<ImpressoApplication>[],
  teardownFunctions: ApplicationHookFunction<ImpressoApplication>[]
) => {
  return (app: ImpressoApplication) => {
    const config = app.get('appHooks')
    debug('global hooks configuration', config)

    const beforeAll = config?.alwaysRequired
      ? [
          requireAuthentication({
            excludePaths: ['authentication', 'users'].concat(config.excludePaths ?? []),
          }),
        ]
      : []

    app.hooks({
      before: {
        all: beforeAll,
        find: [basicParams()],
        get: [basicParams()],
        create: [basicParams()],
      },
      error: {
        all: [errorHandler],
      },
    })
    // this is counterintuitive, but the hooks above and the setup/teardown
    // hooks have to be added in two separate calls, otherwise feathers
    // will report an error.
    app.hooks({
      setup: setupFunctions,
      teardown: teardownFunctions,
    })
  }
}
