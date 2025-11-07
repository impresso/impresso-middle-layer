import RefParser, { FileInfo } from '@apidevtools/json-schema-ref-parser'
import type { Application } from '@feathersjs/express'
import { HookContext, NextFunction } from '@feathersjs/hooks'
import convertSchema from '@openapi-contrib/json-schema-to-openapi-schema'
import * as OpenApiValidator from 'express-openapi-validator'
import { HttpError as OpenApiHttpError } from 'express-openapi-validator/dist/framework/types'
import type { OpenAPIV3, OpenApiValidatorOpts, ValidationError } from 'express-openapi-validator/dist/framework/types'
import fs from 'fs'
import { logger } from '../logger'
import type { ImpressoApplication } from '../types'
import { parseFilters } from '../util/queryParameters'
import type {
  NextFunction as ExpressNextFunction,
  Request as ExpressRequest,
  Response as ExpressResponse,
} from 'express'
import { FeathersError } from '@feathersjs/errors'

export default (app: ImpressoApplication & Application) => {
  installMiddleware(app)
}

/**
 * Configure and install validation middleware. This must be done before
 * `@feathersjs/express/rest` middleware is installed and services are registered.
 *
 * Actual configuration of the final OAI spec is done in the `init` hook, after the
 * services are registered.
 */
const installMiddleware = (app: ImpressoApplication & Application) => {
  const isPublicApi = app.get('isPublicApi')
  if (!isPublicApi) return

  const openApiConfig = app.get('openapi') ?? {}

  if (!('docs' in app))
    throw new Error('`docs` property not found in app object. Is swagger initialized? (app.use(swager))')

  const spec = (app as any)['docs'] as unknown as OpenAPIV3.DocumentV3

  const options: Omit<OpenApiValidatorOpts, 'apiSpec'> = {
    validateRequests:
      openApiConfig?.validateRequests == false
        ? false
        : {
            allowUnknownQueryParameters: false,
            removeAdditional: true,
          },
    validateResponses:
      openApiConfig?.validateResponses == false
        ? false
        : {
            removeAdditional: false,
            onError: (err: ValidationError, json: any, req: any) => {
              const errorMessage = JSON.stringify(err.errors, null, 2)
              logger.error(`OpenAPI Response validation error: ${errorMessage}`)
            },
          },
    validateApiSpec: openApiConfig.validateSpec == false ? false : true,
    useRequestUrl: false,
    ignoreUndocumented: true,
  }
  const middlewares = OpenApiValidator.middleware({
    ...options,
    apiSpec: {
      info: spec.info,
      openapi: spec.openapi,
      paths: {},
    },
  })

  app.set('openApiMiddlewareOpts', options)
  app.set('openApiValidatorMiddlewares', middlewares)

  // TODO: an ugly way to handle `filters` query parameter before it reaches validation
  // Move this somewhere where it's more explicit
  app.use((req, res, next) => {
    if (req.query.filters != null) {
      req.query.filters = parseFilters(req.query.filters) as any as string[]
    }
    next()
  })

  // app.use(middlewares as any)
  middlewares.forEach((middleware, index) => {
    logger.debug(`Install middleware: ${middleware.name}`)
    app.use((req, res, next) => {
      const handler = app.get('openApiValidatorMiddlewares')[index]
      handler(req, res, next)
    })
  })

  app.use((error: any, req: ExpressRequest, res: ExpressResponse, next: ExpressNextFunction) => {
    if (error instanceof OpenApiHttpError) {
      next(convertOpenApiError(error))
    } else {
      next(error)
    }
  })
}

const convertOpenApiError = (error: OpenApiHttpError): FeathersError => {
  const newError = new FeathersError(error, 'OpenApiError', error.status, error.constructor.name, {})
  newError.stack = error.stack
  return newError
}

/**
 * The "app setup" hook. This hook is called after all services are registered.
 * It must be registered if the middleware has been installed (see `installMiddleware`).
 * See https://feathersjs.com/api/hooks#setup-and-teardown.
 */
export const init = async (context: HookContext<ImpressoApplication & Application>, next: NextFunction) => {
  const app = context.app

  const isPublicApi = app.get('isPublicApi')
  if (!isPublicApi) return await next()

  logger.info('Initialising OpenAPI validator middleware')

  if (!('docs' in app))
    throw new Error('`docs` property not found in app object. Is swagger initialized? (app.use(swager))')

  const spec = (app as any)['docs'] as unknown as OpenAPIV3.DocumentV3

  const options = app.get('openApiMiddlewareOpts')
  if (options == null)
    throw new Error(
      'OpenAPI middleware options not found. Have you called the `init` hook before installing the middleware?'
    )

  try {
    await dereferenceSpec(spec)
  } catch (error) {
    logger.error('Failed to dereference OpenAPI spec', error)
    throw error
  }

  const middlewares = OpenApiValidator.middleware({ ...options, apiSpec: spec })
  app.set('openApiValidatorMiddlewares', middlewares)

  logger.info('OpenAPI validator middleware initialised')
  await next()
}

const dereferenceSpec = async (spec: OpenAPIV3.DocumentV3) => {
  // NOTE: mutates original spec
  // This is done on purpose because we want to serve the original spec dereferenced.
  await RefParser.bundle(spec, {
    resolve: {
      file: {
        /**
         * All JSON schema files are relative to the
         * `src` / `dist` directory. Adding it here.
         */
        read: async (file: FileInfo) => {
          const cwd = process.cwd()
          const filePath = file.url.replace(cwd, `${cwd}/src`)
          const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
          return await convertSchema(content)
        },
      },
    },
  })
}
