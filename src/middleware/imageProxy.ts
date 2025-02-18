import { AuthenticationService } from '@feathersjs/authentication'
import { Forbidden } from '@feathersjs/errors'
import { Application as ExpressApplication, Request, RequestHandler, Response } from 'express'
import { ServerResponse } from 'http'
import {
  createProxyMiddleware,
  debugProxyErrorsPlugin,
  proxyEventsPlugin,
  responseInterceptor,
} from 'http-proxy-middleware'
import { extname, join } from 'node:path'
import { SimpleSolrClient } from '../internalServices/simpleSolr'
import { logger } from '../logger'
import { BufferUserPlanGuest } from '../models/user-bitmap.model'
import { SolrNamespaces } from '../solr'
import { ImpressoApplication } from '../types'
import { bufferToBigInt, OpenPermissions } from '../util/bigint'

const NotAuthorizedImageUrl = '/images/notAuthorized.jpg'

const getContentItemId = (imagePath: string): string | undefined => {
  const match = imagePath.match(/([A-Za-z]+-\d{4}-\d{2}-\d{2}-[a-z]+)*-p[0-9]+/)
  if (match == null) return undefined
  const [contentItemId, _issueUid] = match
  return contentItemId
}

const getContentItemPermissionBitmap = async (
  solr: SimpleSolrClient,
  contentItemId: string | undefined
): Promise<bigint | undefined> => {
  if (contentItemId == null) return
  const result = await solr.selectOne<{
    rights_bm_get_img_l: bigint | undefined
    rights_bm_explore_l: bigint | undefined
  }>(SolrNamespaces.Search, {
    body: {
      query: `page_id_ss:${contentItemId}`,
      fields: 'rights_bm_get_img_l,rights_bm_explore_l',
    },
  })
  return result?.rights_bm_explore_l != null ? BigInt(result?.rights_bm_explore_l) : undefined
}

const getUserBitmap = async (
  authService: AuthenticationService,
  token: string | undefined
): Promise<bigint | undefined> => {
  if (token == null) return
  const tokenContent = await authService.verifyAccessToken(token)
  if (tokenContent.bitmap != null) return bufferToBigInt(Buffer.from(tokenContent.bitmap, 'base64'))
}

const getToken = (req: Request): string | undefined => {
  const cookieToken = req.cookies['feathers-jwt']
  const bearerHeaderToken = (req.headers['authentication'] as string)?.replace?.(/^Bearer /, '')
  return cookieToken ?? bearerHeaderToken
}

const getAuthHandlerMiddleware = (app: ImpressoApplication): RequestHandler => {
  const handler: RequestHandler = async (req, res, next) => {
    const { imagePath } = req.params
    const token = getToken(req)

    try {
      const contentBitmapAwaitable = getContentItemPermissionBitmap(
        app.service('simpleSolrClient'),
        getContentItemId(imagePath)
      )
      const userBitmapAwaitable = getUserBitmap(app.service('authentication'), token)

      const [contentBitmap = OpenPermissions, userBitmap = BufferUserPlanGuest] = await Promise.all([
        contentBitmapAwaitable,
        userBitmapAwaitable,
      ])

      const accessAllowed = (userBitmap & contentBitmap) != BigInt(0)

      if (!accessAllowed) return next(new Forbidden())
      return next()
    } catch (e) {
      return next(e)
    }
  }
  return handler
}

const getProxyMiddleware = (app: ImpressoApplication, prefix: string) => {
  const { defaultSourceId, sources } = app.get('images').proxy
  const source = sources.find(({ id }) => id === defaultSourceId) ?? sources[0]
  return createProxyMiddleware<Request, Response>({
    target: source.endpoint,
    changeOrigin: true,
    selfHandleResponse: true, // res.end() will be called internally by responseInterceptor()
    followRedirects: true,
    logger: undefined,
    on: {
      proxyReq: (proxyReq, req) => {
        if (source.auth != null) {
          const credentials = Buffer.from(`${source.auth.user}:${source.auth.pass}`).toString('base64')
          proxyReq.setHeader('Authorization', `Basic ${credentials}`)
        }
      },
      proxyRes: responseInterceptor(async (buffer: Buffer, proxyRes, req, res) => {
        const response = res as ServerResponse

        switch (proxyRes.statusCode) {
          case 401:
            response.statusCode = 302
            response.setHeader('Location', NotAuthorizedImageUrl)
          case 200:
            if (isJSONContent(proxyRes.headers['content-type'])) {
              const proxyHost = req.headers['host'] ? `${req.protocol}://${req.headers['host']}` : 'http://localhost'
              const proxyPrefix = `${proxyHost}${prefix}`

              const content = JSON.parse(buffer.toString())
              return JSON.stringify(rewriteIIIFManifest(content, source.endpoint, proxyPrefix))
            }
        }
        return buffer
      }),
    },
    pathRewrite: async (path, req) => {
      const imagePath = req.baseUrl.replace(prefix, '')
      const extension = extname(imagePath)
      if (extension == null || extension.trim() === '') return join(imagePath, 'info.json')
      return imagePath
    },
  })
}

const isJSONContent = (contentType: string | undefined) => contentType === 'application/json'

interface IIIFManifest {
  '@id': string
}

const rewriteIIIFManifest = (
  manifest: IIIFManifest | undefined,
  sourceEndpoint: string,
  proxyPrefix: string
): IIIFManifest | undefined => {
  if (manifest == null) return
  const sourcePath = new URL(sourceEndpoint).pathname
  manifest['@id'] = manifest['@id'].replace(new RegExp(`^.*?${sourcePath}`), `${proxyPrefix}/`)
  return manifest
}

/**
 * Initialise IIIF image proxy.
 */
export const init = (app: ImpressoApplication) => {
  const proxyConfig = app.get('images').proxy

  logger.info('Initialising IIIF image proxy v2')
  const prefix = '/proxy/iiif'
  const expressApp = app as any as ExpressApplication
  expressApp.use(`${prefix}/:imagePath(.+$)`, getAuthHandlerMiddleware(app), getProxyMiddleware(app, prefix))
}
