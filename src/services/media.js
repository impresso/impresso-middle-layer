/* eslint global-require: "off" */
/* eslint import/no-dynamic-require: "off" */
const debug = require('debug')('impresso/media');
const { BadRequest, NotFound, NotAuthenticated } = require('@feathersjs/errors');

module.exports = function (app) {
  const config = app.get('media');
  const authentication = app.get('authentication');

  debug('configuring media ...', config.host, config.path);

  app.use(`${config.path}/:service/:id`, [
    function (req, res, next) {
      if (config.services.indexOf(req.params.service) === -1) {
        throw new BadRequest('incomplete request params (service)');
      }

      if (!/^\d+$/.test(req.params.id)) {
        throw new BadRequest('incomplete request params (id)');
      }
      next();
    },
    function (req, res, next) {
      debug('using req params:', req.params);
      let accessToken = req.headers.authorization;

      if (req.cookies && req.cookies[authentication.cookie.name]) {
        accessToken = req.cookies[authentication.cookie.name] || req.headers.authorization;
      }

      if (!accessToken) {
        debug('no auth found, return public contents only.');
        // do nothing, we're going for the "public" endpoint
        res.send('fin');
        res.end();
      } else {
        res.locals.accessToken = accessToken.replace(/Bearer\s+/, '');
        next();
      }
    },
    function (req, res, next) {
      // check payload
      debug('check access token...');
      app.passport.verifyJWT(res.locals.accessToken, {
        secret: authentication.secret,
      }).then((payload) => {
        debug('access token valid, adding payloads...');
        res.locals.payload = payload;
        res.locals.user = {
          uid: res.locals.payload.userId,
        };
        next();
      }).catch((err) => {
        debug('Error! auth found, with INVALID payload.', err);
        next(new NotAuthenticated());
      });
    },
    // get item according to service. item must have an attachment property
    function (req, res, next) {
      debug(`calling ${req.params.service}:get(${req.params.id}) with authentified user uid: ${res.locals.user.uid}`);
      // a class having an attachment
      app.service(req.params.service).get(req.params.id, {
        user: res.locals.user,
      }).then((item) => {
        res.locals.item = item;
        debug(`service '${req.params.service}.get(${req.params.id})' success, check attachments...`);
        next();
      }).catch((err) => {
        next(err);
      });
    },
    function (req, res) {
      if (!res.locals.item.attachment) {
        throw new NotFound();
      }
      const filename = res.locals.item.attachment.path.split('/').pop();
      const protectedFilepath = [config.protectedPath, res.locals.item.attachment.path].join('/');
      debug('flush headers for filename:', filename, protectedFilepath);
      res.set('Content-Disposition', `attachment; filename=${filename}`);
      res.set('X-Accel-Redirect', protectedFilepath);
      res.send();
      res.end();
    },
  ]);
};
