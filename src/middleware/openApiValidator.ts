import RefParser, { FileInfo } from '@apidevtools/json-schema-ref-parser'
import type { Application } from '@feathersjs/express'
import { HookContext, NextFunction } from '@feathersjs/hooks'
import convertSchema from '@openapi-contrib/json-schema-to-openapi-schema'
import * as OpenApiValidator from 'express-openapi-validator'
import type { OpenAPIV3, OpenApiValidatorOpts } from 'express-openapi-validator/dist/framework/types'
import fs from 'fs'
import { logger } from '../logger'
import type { ImpressoApplication } from '../types'

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

  if (!('docs' in app))
    throw new Error('`docs` property not found in app object. Is swagger initialized? (app.use(swager))')

  const spec = (app as any)['docs'] as unknown as OpenAPIV3.Document

  const options: Omit<OpenApiValidatorOpts, 'apiSpec'> = {
    validateRequests: {
      allowUnknownQueryParameters: false,
      removeAdditional: true,
    },
    validateResponses: {
      removeAdditional: false,
      onError: (err: Error, json: any, req: any) => {
        logger.error('OpenAPI Response validation error: ', err, json)
      },
    },
    validateApiSpec: true,
    useRequestUrl: false,
    ignoreUndocumented: false,
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

  // app.use(middlewares as any)
  // app.use(middlewares as any)
  middlewares.forEach((middleware, index) => {
    logger.debug('Install', middleware)
    app.use((req, res, next) => {
      const handler = app.get('openApiValidatorMiddlewares')[index]
      handler(req, res, next)
    })
  })
}

/**
 * The "app setup" hook. This hook is called after all services are registered.
 * It must be registered if the middleware has been installed (see `installMiddleware`).
 * See https://feathersjs.com/api/hooks#setup-and-teardown.
 */
export const init = async (context: HookContext<ImpressoApplication & Application>, next: NextFunction) => {
  logger.info('Initialising OpenAPI validator middleware')

  const app = context.app

  if (!('docs' in app))
    throw new Error('`docs` property not found in app object. Is swagger initialized? (app.use(swager))')

  const spec = (app as any)['docs'] as unknown as OpenAPIV3.Document

  const options = app.get('openApiMiddlewareOpts')
  if (options == null)
    throw new Error(
      'OpenAPI middleware options not found. Have you called the `init` hook before installing the middleware?'
    )

  await dereferenceSpec(spec)

  const middlewares = OpenApiValidator.middleware({ ...options, apiSpec: spec })
  app.set('openApiValidatorMiddlewares', middlewares)

  logger.info('OpenAPI validator middleware intialised')
}

const dereferenceSpec = async (spec: OpenAPIV3.Document) => {
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
          const filePath = file.url.replace(cwd, `${cwd}/dist`)
          const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
          return await convertSchema(content)
        },
      },
    },
  })
}
