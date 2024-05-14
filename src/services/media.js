/* eslint global-require: "off" */
/* eslint import/no-dynamic-require: "off" */
const debug = require('debug')('impresso/media')
const { BadRequest, NotFound } = require('@feathersjs/errors')
// const { authenticate } = require('@feathersjs/authentication');

module.exports = function (app) {
  const config = app.get('media')

  debug('configuring media ...', config.host, config.path)

  app.use(`${config.path}/:service/:id`, [
    // authenticate token!
    // authenticate('jwt'),
    async function (req, res, next) {
      if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Origin', '*')
        res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        return res.status(200).send()
      }
      const token = req.headers.authorization
      if (!token || !token.startsWith('Bearer ')) {
        throw new BadRequest('Missing or invalid authorization token')
      }
      const authToken = token.split(' ')[1]
      console.log('authToken', authToken)
      const payload = await app.service('/authentication').create({ strategy: 'jwt', accessToken: authToken })
      console.log('payload', payload)
      // Authenticate the token here using your authentication logic
      // For example, you can use a JWT library to verify the token
      // and extract the user information from it

      req.user = payload.user
      next()
    },
    function (req, res, next) {
      if (config.services.indexOf(req.params.service) === -1) {
        throw new BadRequest('incomplete request params (service)')
      }

      if (!/^\d+$/.test(req.params.id)) {
        throw new BadRequest('incomplete request params (id)')
      }

      debug(`[${req.params.service}:${req.params.id}] Call ${req.params.service}.get using user uid: ${req.user.uid}`)
      // a class having an attachment
      app
        .service(req.params.service)
        .get(req.params.id, {
          user: req.user,
        })
        .then(item => {
          res.locals.item = item
          debug(`[${req.params.service}:${req.params.id}]  ${req.params.service}.get success, check attachments...`)
          if (!item.attachment) {
            throw new NotFound()
          }
          next()
        })
        .catch(err => {
          next(err)
        })
    },
    function (req, res) {
      const filename = res.locals.item.attachment.path.split('/').pop()
      debug(`[${req.params.service}:${req.params.id}]`, 'original filepath:', res.locals.item.attachment.path)
      const protectedFilepath = [config.protectedPath, res.locals.item.attachment.path].join('/')
      debug(`[${req.params.service}:${req.params.id}]`, 'flush headers for filename:', filename, protectedFilepath)
      res.set('Content-Disposition', `attachment; filename=${filename}`)
      res.set('X-Accel-Redirect', protectedFilepath)
      res.set('Access-Control-Allow-Origin', '*')
      res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
      res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
      res.send()
      res.end()
    },
  ])
}
