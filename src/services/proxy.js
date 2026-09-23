/**
 * @deprecated NOTE: This proxy is not used anymore. It is kept for
 * historical references. Use the proxy from the middleware folder instead.
 */

import { getLogger } from '@/logger.js'
const logger = getLogger(['impresso', 'proxy'])
import { createProxyMiddleware } from 'http-proxy-middleware'
import modifyResponse from 'node-http-proxy-json'
import nodePath from 'path'
import { QueryTypes } from 'sequelize'
import { ACCESS_RIGHT_OPEN_PUBLIC } from '../models/articles.model'

/**
 * Internal redirect using X accel Redirect (NGINX) to speed up (and cache) image delivery.
 * @param  {Response} res             Eprress response object
 * @param  {String} protectedPath='/' NGINX Protected path
 * @param  {String} filepath=''       Filepath
 * @return {null}                     End response with X accel headers
 */
const internalRedirect = ({ res, protectedPath = '/', filepath = '' } = {}) => {
  const protectedFilepath = [protectedPath, filepath].join('/').replace(/\/+/g, '/')
  logger.debug(`internalRedirect to: ${protectedFilepath}`)
  res.set('X-Accel-Redirect', protectedFilepath)
  res.send()
  res.end()
}

/**
 * Return boolean response if specific issueId is OpenPublic. This function
 * always returns false if an exception is raised during its execution.
 * @param  {String} filepath
 * @param  {Object} sequelizeClient
 * @return
 */
const isIssueOpenPublic = async (issueId, sequelizeClient) => {
  logger.debug(`isIssueOpenPublic issueId: ${issueId} ...`)
  try {
    const result = await sequelizeClient.query('SELECT access_rights FROM issues WHERE id = ? LIMIT 1', {
      replacements: [issueId],
      type: QueryTypes.SELECT,
    })
    logger.debug(`isIssueOpenPublic issueId: ${issueId} - access_rights: ${result[0].access_rights}`)
    // if there's an error, we put false.
    return result[0].access_rights === ACCESS_RIGHT_OPEN_PUBLIC
  } catch (e) {
    logger.debug(`isIssueOpenPublic exception thrown, discarded. ${e}`)
    return false
  }
}

export default function (app) {
  const config = app.get('proxy')
  const proxyhost = app.get('proxy').host
  const sequelizeClient = app.get('sequelizeClient')
  logger.debug(`configuring proxy host: ${proxyhost}`)
  logger.info('configuring proxy ...')

  const proxyPublicAuthorization = config.iiif.epfl.auth

  app.use(
    '/proxy/iiif',
    async (req, res, next) => {
      // get extension
      const isImage = ['png'].indexOf(req.originalUrl.split('.').pop()) !== -1
      const filepath = req.originalUrl.replace('/proxy/iiif', '/')
      const accessToken = req.headers.authorization
      // do not accept cookies anymore. The following is now deprecated:
      // ```
      // const authentication = app.get('authentication');
      // ...
      // if (req.cookies && req.cookies[authentication.cookie.name]) {
      //   accessToken = req.cookies[authentication.cookie.name] || req.headers.authorization;
      // }
      // ```
      if (!accessToken) {
        // check filepath
        const [contentItemId, issueId] = filepath.match(/([A-Za-z]+-\d{4}-\d{2}-\d{2}-[a-z]+)*-p[0-9]+/)

        const isOpenPublic = await isIssueOpenPublic(issueId, sequelizeClient)
        if (isOpenPublic) {
          logger.debug(`no auth found, but contentItemId: ${contentItemId} is OpenPublic.`)
          req.proxyAuthorization = config.iiif.epflsafe.auth
          if (config.iiif.internalOnly && isImage) {
            internalRedirect({
              res,
              filepath,
              protectedPath: config.iiif.protected.endpoint,
            })
          }
          next()
        } else if (config.iiif.internalOnly && isImage) {
          logger.debug('proxy: no auth found, try public endpoint directly.')
          // do nothing, try "public" endpoint with xaccel
          internalRedirect({
            res,
            filepath,
            protectedPath: config.iiif.public.endpoint,
          })
        } else {
          next()
        }
        return
      }

      // verify access token and user rights
      app
        .service('/authentication')
        .verifyAccessToken(accessToken.replace(/^Bearer /, ''))
        .then(payload => {
          logger.debug(`proxy: auth found, payload OK. <userId>: ${payload.userId}`)
          req.proxyAuthorization = config.iiif.epflsafe.auth
          // check authorization level in user service.
          if (config.iiif.internalOnly && isImage) {
            // xaccel
            internalRedirect({
              res,
              filepath,
              protectedPath: config.iiif.protected.endpoint,
            })
          } else {
            next()
          }
        })
        .catch(err => {
          logger.debug(`proxy: auth found, INVALID payload. ${err}`)
          // x accel for the images
          // do nothing, we're going for the "public" endpoint
          if (config.iiif.internalOnly && isImage) {
            // xaccel
            internalRedirect({
              res,
              filepath,
              protectedPath: config.iiif.public.endpoint,
            })
          } else {
            next()
          }
        })
    },
    createProxyMiddleware({
      target: config.iiif.epfl.endpoint, // https://dhlabsrv17.epfl.ch/iiif_impresso/"GDL-1900-01-10-a-p0002/full/full/0/default.jpg
      pathRewrite: path => {
        const extension = nodePath.extname(path)
        logger.debug(`proxy: <extension>: ${extension}`)
        if (!extension.length) {
          logger.debug("proxy: rewrite empty extension to 'info.json'")
          return nodePath.join(path.replace('/proxy/iiif', '/'), 'info.json')
        }

        // console.log('REPLACING', typeof );
        return path.replace('/proxy/iiif', '/')
      },
      changeOrigin: true,
      logProvider: () => logger,
      logLevel: 'info',
      onProxyReq: (proxyReq, req) => {
        logger.debug(`proxy: @onProxyReq <path> ${proxyReq.path}`)
        let credentials
        if (req.proxyAuthorization) {
          logger.debug('proxy: @onProxyReq using PRIVATE credentials')
          credentials = Buffer.from(`${req.proxyAuthorization.user}:${req.proxyAuthorization.pass}`).toString('base64')
        } else {
          logger.debug('proxy: @onProxyReq using PUBLIC credentials.')
          credentials = Buffer.from(`${proxyPublicAuthorization.user}:${proxyPublicAuthorization.pass}`).toString(
            'base64'
          )
        }
        proxyReq.setHeader('Authorization', `Basic ${credentials}`)
      },
      onError: (err, req, res) => {
        logger.debug(`proxy: @onError <path> ${req.path} ${err}`)
        res.writeHead(500, {
          'Content-Type': 'text/plain',
        })
        res.end(`Something went wrong. And we are reporting a custom error message. Code: ${err.code}`)
      },
      onProxyRes: (proxyRes, req, res) => {
        logger.debug(`proxy: @onProxyRes <res.statusCode>: ${proxyRes.statusCode} ${proxyRes.headers['content-type']}`)
        if (proxyRes.statusCode === 401) {
          res.redirect('/img/notAuthorized.jpg')
        } else if (proxyRes.statusCode === 200 && proxyRes.headers['content-type'] === 'application/json') {
          // modify HOST in every IIIF fields, when needed.
          modifyResponse(res, proxyRes, iiif => {
            if (iiif) {
              logger.debug(`proxy: @onProxyRes modifyResponse ${iiif['@id']}`)
              // modify some information, deeper and deeper...?
              // We probably need just the very first level (for the moment).
              iiif['@id'] = iiif['@id'].replace(/^.*?\/iiif_impresso\//, `${proxyhost}/proxy/iiif/`)
            }
            return iiif // return value can be a promise
          })
        }
      },
    })
  )
}
