import swagger, { swaggerUI } from 'feathers-swagger'
import { logger } from '@/logger.js'
import { ImpressoApplication } from '@/types.js'
import fs from 'fs'
import path from 'path'
import { Application } from '@feathersjs/express'

const schemaBaseDir = path.join(__dirname, '../schema')

interface SchemaRef {
  $ref: string
}

const getFilesAsSchemaRefs = (dir: string, prefix: string): Record<string, SchemaRef> => {
  if (!fs.existsSync(dir)) {
    return {}
  }

  const allFiles = fs.readdirSync(dir)

  return allFiles
    .filter(f => f.endsWith('.json'))
    .reduce(
      (acc, f) => {
        const key = path.basename(f, '.json')
        acc[key] = {
          $ref: `${prefix}/${key}.json`,
        }
        return acc
      },
      {} as Record<string, SchemaRef>
    )
}

function getRedirectPrefix({ req, ctx }: any) {
  const headers = (req && req.headers) || (ctx && ctx.headers) || {}
  return headers['x-forwarded-prefix'] ? headers['x-forwarded-prefix'] : ''
}

/**
 * Copied from `feathers-swagger`. Added `persistAuthorization` option.
 */
function generateSwaggerUIInitializerScript({ docsJsonPath, ctx, req }: any) {
  const basePath = getRedirectPrefix({ req, ctx })

  return `
    window.onload = function() {
      window.ui = SwaggerUIBundle({
        url: "${basePath}${docsJsonPath}",
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout",
        persistAuthorization: true
      });
    };
  `
}

export default (app: ImpressoApplication & Application) => {
  if (!app.get('isPublicApi')) {
    logger.info('Internal API - swagger middleware is disabled')
    return
  }
  logger.info('Public API - swagger middleware is enabled')

  const prefix = app.get('publicApiPrefix')

  const swaggerItem = swagger({
    openApiVersion: 3,
    specs: {
      info: {
        title: 'Impresso Public API',
        description: 'Impresso Public API Documentation',
        version: require('../../package.json').version,
        contact: {
          name: 'Impresso Project team',
          url: 'https://impresso-project.ch/',
          email: 'info@impresso-project.ch',
        },
      },
      components: {
        schemas: {
          // shared schemas (shared by both internal and external schemas)
          ...getFilesAsSchemaRefs(`${schemaBaseDir}/shared`, './schema/shared'),
          // public schemas
          ...getFilesAsSchemaRefs(`${schemaBaseDir}/schemasPublic`, './schema/schemasPublic'),
        },
        requestBodies: getFilesAsSchemaRefs(`${schemaBaseDir}/requestBodies`, './schema/requestBodies'),
        responses: getFilesAsSchemaRefs(`${schemaBaseDir}/responses`, './schema/responses'),
        parameters: getFilesAsSchemaRefs(`${schemaBaseDir}/parameters`, './schema/parameters'),
        securitySchemes: {
          BearerAuth: {
            type: 'http',
            scheme: 'bearer',
          },
        },
      },
      security: [{ BearerAuth: [] }],
      // "ignore" does not pass schema validator
      // ignore: {
      //   tags: ['not-used'],
      // },
      servers:
        prefix != null
          ? [
              {
                url: `${prefix}/`,
                description: 'Impresso Public API',
                'x-internal': false,
              },
            ]
          : undefined,
    },
    ui: swaggerUI({
      getSwaggerInitializerScript: generateSwaggerUIInitializerScript,
    }),
  })
  app.configure(swaggerItem)
}
