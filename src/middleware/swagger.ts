import swagger, { swaggerUI } from 'feathers-swagger'
import { logger } from '../logger'
import { ImpressoApplication } from '../types'

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

export default (app: ImpressoApplication) => {
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
      },
      components: {
        securitySchemes: {
          BearerAuth: {
            type: 'http',
            scheme: 'bearer',
          },
        },
      },
      security: [{ BearerAuth: [] }],
      servers:
        prefix != null
          ? [
              {
                url: `${prefix}/`,
                description: 'Impresso Public API',
              },
            ]
          : undefined,
    },
    ui: swaggerUI({
      getSwaggerInitializerScript: generateSwaggerUIInitializerScript,
    }),
  })
  return app.configure(swaggerItem)
}
