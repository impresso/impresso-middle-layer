const logger = require('winston');
const debug = require('debug')('verbose:impresso/proxy');
const { createProxyMiddleware } = require('http-proxy-middleware');
const modifyResponse = require('node-http-proxy-json');
const nodePath = require('path');
const { QueryTypes } = require('sequelize');
const { ACCESS_RIGHT_OPEN_PUBLIC } = require('../models/articles.model');


/**
 * Internal redirect using X accel Redirect (NGINX) to speed up (and cache) image delivery.
 * @param  {Response} res             Eprress response object
 * @param  {String} protectedPath='/' NGINX Protected path
 * @param  {String} filepath=''       Filepath
 * @return {null}                     End response with X accel headers
 */
const internalRedirect = ({
  res,
  protectedPath = '/',
  filepath = '',
} = {}) => {
  const protectedFilepath = [protectedPath, filepath].join('/').replace(/\/+/g, '/');
  debug('internalRedirect to:', protectedFilepath);
  res.set('X-Accel-Redirect', protectedFilepath);
  res.send();
  res.end();
};


/**
 * Return boolean response if specific issueUid is OpenPublic. This function
 * always returns false if an exception is raised during its execution.
 * @param  {String} filepath
 * @param  {Object} sequelizeClient
 * @return
 */
const isIssueOpenPublic = async (issueUid, sequelizeClient) => {
  debug('isIssueOpenPublic issueUid:', issueUid, '...');
  try {
    const result = await sequelizeClient.query('SELECT access_rights FROM issues WHERE id = ? LIMIT 1', {
      replacements: [issueUid],
      type: QueryTypes.SELECT,
    });
    debug('isIssueOpenPublic issueUid:', issueUid, '- access_rights:', result[0].access_rights);
    // if there's an error, we put false.
    return result[0].access_rights === ACCESS_RIGHT_OPEN_PUBLIC;
  } catch (e) {
    debug('isIssueOpenPublic exception thrown, discarded.', e);
    return false;
  }
};


module.exports = function (app) {
  const config = app.get('proxy');
  const proxyhost = app.get('proxy').host;
  const sequelizeClient = app.get('sequelizeClient');
  debug('configuring proxy host:', proxyhost);
  logger.info('configuring proxy ...');

  const proxyPublicAuthorization = config.iiif.epfl.auth;

  app.use('/proxy/iiif', async (req, res, next) => {
    // get extension
    const isImage = ['png'].indexOf(req.originalUrl.split('.').pop()) !== -1;
    const filepath = req.originalUrl.replace('/proxy/iiif', '/');
    const accessToken = req.headers.authorization;
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
      const [contentItemId, issueUid] = filepath
        .match(/([A-Za-z]+-\d{4}-\d{2}-\d{2}-[a-z]+)*-p[0-9]+/);

      const isOpenPublic = await isIssueOpenPublic(issueUid, sequelizeClient);
      if (isOpenPublic) {
        debug('no auth found, but contentItemId:', contentItemId, 'is OpenPublic.');
        req.proxyAuthorization = config.iiif.epflsafe.auth;
        if (config.iiif.internalOnly && isImage) {
          internalRedirect({
            res,
            filepath,
            protectedPath: config.iiif.protected.endpoint,
          });
        }
        next();
      } else if (config.iiif.internalOnly && isImage) {
        debug('proxy: no auth found, try public endpoint directly.');
        // do nothing, try "public" endpoint with xaccel
        internalRedirect({
          res,
          filepath,
          protectedPath: config.iiif.public.endpoint,
        });
      } else {
        next();
      }
      return;
    }

    // verify access token and user rights
    app.service('/authentication').verifyAccessToken(accessToken.replace(/^Bearer /, '')).then((payload) => {
      debug('proxy: auth found, payload OK. <userId>:', payload.userId);
      req.proxyAuthorization = config.iiif.epflsafe.auth;
      // check authorization level in user service.
      if (config.iiif.internalOnly && isImage) {
        // xaccel
        internalRedirect({
          res,
          filepath,
          protectedPath: config.iiif.protected.endpoint,
        });
      } else {
        next();
      }
    }).catch((err) => {
      debug('proxy: auth found, INVALID payload.', err);
      // x accel for the images
      // do nothing, we're going for the "public" endpoint
      if (config.iiif.internalOnly && isImage) {
        // xaccel
        internalRedirect({
          res,
          filepath,
          protectedPath: config.iiif.public.endpoint,
        });
      } else {
        next();
      }
    });
  }, createProxyMiddleware({
    target: config.iiif.epfl.endpoint, // https://dhlabsrv17.epfl.ch/iiif_impresso/"GDL-1900-01-10-a-p0002/full/full/0/default.jpg
    pathRewrite: (path) => {
      const extension = nodePath.extname(path);
      debug('proxy: <extension>:', extension);
      if (!extension.length) {
        debug('proxy: rewrite empty extension to \'info.json\'');
        return nodePath.join(path.replace('/proxy/iiif', '/'), 'info.json');
      }

      // console.log('REPLACING', typeof );
      return path.replace('/proxy/iiif', '/');
    },
    changeOrigin: true,
    logProvider: () => logger,
    logLevel: 'info',
    onProxyReq: (proxyReq, req) => {
      debug('proxy: @onProxyReq <path>', proxyReq.path);
      let credentials;
      if (req.proxyAuthorization) {
        debug('proxy: @onProxyReq using PRIVATE credentials');
        credentials = Buffer.from(`${req.proxyAuthorization.user}:${req.proxyAuthorization.pass}`).toString('base64');
      } else {
        debug('proxy: @onProxyReq using PUBLIC credentials.');
        credentials = Buffer.from(`${proxyPublicAuthorization.user}:${proxyPublicAuthorization.pass}`).toString('base64');
      }
      proxyReq.setHeader('Authorization', `Basic ${credentials}`);
    },
    onError: (err, req, res) => {
      debug('proxy: @onError <path>', req.path, err);
      res.writeHead(500, {
        'Content-Type': 'text/plain',
      });
      res.end(`Something went wrong. And we are reporting a custom error message. Code: ${err.code}`);
    },
    onProxyRes: (proxyRes, req, res) => {
      debug('proxy: @onProxyRes <res.statusCode>:', proxyRes.statusCode, proxyRes.headers['content-type']);
      if (proxyRes.statusCode === 401) {
        res.redirect('/images/notAuthorized.jpg');
      } else if (proxyRes.statusCode === 200 && proxyRes.headers['content-type'] === 'application/json') {
        // modify HOST in every IIIF fields, when needed.
        modifyResponse(res, proxyRes, (iiif) => {
          if (iiif) {
            debug('proxy: @onProxyRes modifyResponse', iiif['@id']);
            // modify some information, deeper and deeper...?
            // We probably need just the very first level (for the moment).
            iiif['@id'] = iiif['@id'].replace(/^.*?\/iiif_impresso\//, `${proxyhost}/proxy/iiif/`);
          }
          return iiif; // return value can be a promise
        });
      }
    },
  }));
};
