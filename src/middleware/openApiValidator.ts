import RefParser, { FileInfo } from '@apidevtools/json-schema-ref-parser'
import type { Application } from '@feathersjs/express'
import convertSchema from '@openapi-contrib/json-schema-to-openapi-schema'
import * as OpenApiValidator from 'express-openapi-validator'
import type { OpenAPIV3 } from 'express-openapi-validator/dist/framework/types'
import fs from 'fs'
import { logger } from '../logger'
import type { ImpressoApplication } from '../types'

export default (app: ImpressoApplication & Application) => {
  init(app).catch(e => {
    logger.error('Important: Failed to initialize OpenAPI validator middleware', e)
  })
}

const init = async (app: ImpressoApplication & Application) => {
  const isPublicApi = app.get('isPublicApi')
  if (!isPublicApi) return

  if (!('docs' in app)) throw new Error('`docs` property not found in app object. Is swagger initialized?')

  const spec = (app as any)['docs'] as unknown as OpenAPIV3.Document

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

  const middlewares = OpenApiValidator.middleware({
    apiSpec: spec,
    validateRequests: true, // (default)
    validateResponses: true, // false by default
    validateApiSpec: true,
  })
  middlewares.forEach(middleware => app.use(middleware))

  logger.info('OpenAPI validator middleware loaded')
}
