const logger = require('winston');
const debug = require('debug')('impresso/proxy');
const proxy = require('http-proxy-middleware');

module.exports = function (app) {
  const config = app.get('proxy');
  const authentication = app.get('authentication');

  logger.info(`configuring proxy ...`)

  const proxyPublicAuthorization = config.iiif.epfl.auth;

  app.use('/proxy/iiif', (req, res, next) => {
    // console.log('Request URL:', req.originalUrl, authentication.cookie.name, req.cookies, req.isAuthenticated());
    // access token from cookies
    let accessToken = req.headers.authorization;

    if(req.cookies && req.cookies[authentication.cookie.name]) {
      accessToken = req.cookies[authentication.cookie.name] || req.headers.authorization;
    }

    if(!accessToken) {
      debug('middleware: no auth found, return public contents only.');
      // do nothing, we're going for the "public" endpoint
      return next();
    }

    app.passport.verifyJWT(accessToken, {
      secret: authentication.secret
    }).then(payload => {
      debug('middleware: auth found, payload OK. <userId>:', payload.userId);
      req.proxyAuthorization = config.iiif.epflsafe.auth;
      // check authorization level in user service.
      next()
    }).catch(err => {
      debug('middleware: auth found, INVALID payload.');
      next()
    })
  }, proxy({
    target: config.iiif.epfl.endpoint, // https://dhlabsrv17.epfl.ch/iiif_impresso/"GDL-1900-01-10-a-p0002/full/full/0/default.jpg
    pathRewrite: {'^/proxy/iiif' : '/'},
    changeOrigin: true,
    logProvider: provider => {
        return logger;
    },
    logLevel: 'info',
    onProxyReq: (proxyReq, req, res) => {
      debug('proxy: @onProxyReq <path>', proxyReq.path);
      let credentials;
      if(req.proxyAuthorization) {
        debug('proxy: @onProxyReq using PRIVATE credentials');
        credentials = new Buffer(`${req.proxyAuthorization.user}:${req.proxyAuthorization.pass}`).toString('base64');
      } else {
        debug('proxy: @onProxyReq using PUBLIC credentials.');
        credentials = new Buffer(`${proxyPublicAuthorization.user}:${proxyPublicAuthorization.pass}`).toString('base64');
      }
      proxyReq.setHeader('Authorization', `Basic ${credentials}`);
    },
    onProxyRes: (proxyRes, req, res) => {
      debug('proxy: @onProxyRes <res.statusCode>:', proxyRes.statusCode);
      if(proxyRes.statusCode > 400) {
        res.redirect('/images/notAuthorized.jpg');
      }
    }
  }));
}
