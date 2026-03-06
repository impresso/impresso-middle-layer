import swagger from 'feathers-swagger'
import { logger } from '@/logger.js'
import { ImpressoApplication } from '@/types.js'
import fs from 'fs'
import path, { dirname } from 'path'
import { Application } from '@feathersjs/express'
import { fileURLToPath } from 'url'

const { swaggerUI } = swagger

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const packageJsonUrl = path.join(__dirname, '../../package.json')

interface SchemaRef {
  $ref: string
}

type SchemaRefs = Record<string, SchemaRef>

const resolveSchemaBaseDir = (): string => {
  const candidates = [
    path.join(__dirname, '../schema'),
    path.join(__dirname, '../../src/schema'),
    path.join(process.cwd(), 'src/schema'),
    path.join(process.cwd(), 'schema'),
  ]

  const matchingCandidate = candidates.find(dir => fs.existsSync(path.join(dir, 'canonical')))
  if (matchingCandidate != null) {
    return matchingCandidate
  }

  throw new Error(`Swagger schema directory not found. Checked: ${candidates.join(', ')}`)
}

const schemaBaseDir = resolveSchemaBaseDir()

const getFilesAsSchemaRefs = (dir: string, prefix: string, required = false): Record<string, SchemaRef> => {
  if (!fs.existsSync(dir)) {
    if (required) {
      throw new Error(`Swagger schema directory not found: ${dir}`)
    }

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

const ensureRequiredSchemas = (schemas: SchemaRefs): SchemaRefs => {
  const result = { ...schemas }

  if (result.ContentItem == null) {
    const contentItemSchemaPath = path.join(schemaBaseDir, 'canonical/contentItem/ContentItem.json')
    if (fs.existsSync(contentItemSchemaPath)) {
      result.ContentItem = { $ref: './schema/canonical/contentItem/ContentItem.json' }
      logger.error('Recovered missing Swagger component schema: ContentItem')
    }
  }

  if (result.ContentItem == null) {
    throw new Error(
      `Swagger component schema "ContentItem" is missing. ` +
        `schemaBaseDir=${schemaBaseDir}, availableSchemas=${Object.keys(result).join(', ')}`
    )
  }

  return result
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
  logger.info(`Swagger schema directory: ${schemaBaseDir}`)

  const prefix = app.get('publicApiPrefix')
  const schemas = ensureRequiredSchemas({
    // canonical schemas
    ...getFilesAsSchemaRefs(`${schemaBaseDir}/canonical`, './schema/canonical', true),
    ...getFilesAsSchemaRefs(`${schemaBaseDir}/canonical/contentItem`, './schema/canonical/contentItem', true),
    // app specific schemas
    ...getFilesAsSchemaRefs(`${schemaBaseDir}/app`, './schema/app'),
    ...getFilesAsSchemaRefs(`${schemaBaseDir}/app/requests`, './schema/app/requests'),
    ...getFilesAsSchemaRefs(`${schemaBaseDir}/app/responses`, './schema/app/responses'),
  })

  const swaggerItem = swagger({
    openApiVersion: 3,
    specs: {
      info: {
        title: 'Impresso Public API',
        description: 'Impresso Public API Documentation',
        version: JSON.parse(fs.readFileSync(packageJsonUrl, 'utf8')).version,
        contact: {
          name: 'Impresso Project team',
          url: 'https://impresso-project.ch/',
          email: 'info@impresso-project.ch',
        },
      },
      components: {
        schemas,
        requestBodies: getFilesAsSchemaRefs(`${schemaBaseDir}/app/requests`, './schema/app/requests'),
        responses: getFilesAsSchemaRefs(`${schemaBaseDir}/app/responses`, './schema/app/responses'),
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
