import type { OpenAPIV3 } from 'express-openapi-validator/dist/framework/types'
import RefParser, { FileInfo } from '@apidevtools/json-schema-ref-parser'
import type { ImpressoApplication } from '../types'
import type { Application } from '@feathersjs/express'
import * as OpenApiValidator from 'express-openapi-validator'
import fs from 'fs'

export default async (app: ImpressoApplication & Application) => {
  const isPublicApi = app.get('isPublicApi')
  if (!isPublicApi) return

  if (!('docs' in app)) throw new Error('`docs` property not found in app object. Is swagger initialized?')
  const spec = (app as any)['docs'] as unknown as OpenAPIV3.Document

  const dereferencedOpenApiSpec = await RefParser.dereference(spec, {
    resolve: {
      file: {
        /**
         * All JSON schema files are relative to the
         * `src` / `dist` directory. Adding it here.
         */
        read: (file: FileInfo) => {
          const cwd = process.cwd()
          const filePath = file.url.replace(cwd, `${cwd}/dist`)
          return fs.readFileSync(filePath, 'utf-8')
        },
      },
    },
  })

  const middlewares = OpenApiValidator.middleware({
    apiSpec: dereferencedOpenApiSpec as unknown as OpenAPIV3.Document,
    validateRequests: true, // (default)
    validateResponses: true, // false by default
    validateApiSpec: false,
  })
  middlewares.forEach(middleware => app.use(middleware))
}
