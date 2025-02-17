import debugModule from 'debug'
import { Request, Response, NextFunction } from 'express'
import type { Application as ExpressApplication } from '@feathersjs/express'

import { ImpressoApplication } from '../types'
import User from '../models/users.model'
const debug = debugModule('impresso/media')

const { BadRequest, NotFound } = require('@feathersjs/errors')

// TODO: generate this from schema when it's available (see attachments.model.js)
interface Attachment {
  path: string
}
interface Job {
  attachment?: Attachment
}

interface ResponseLocals {
  user?: User
  item?: Job
}

export default (app: ImpressoApplication & ExpressApplication) => {
  const config = app.get('media')

  if (!config) {
    debug('Error! Media is not configured. No task management is available.')
    throw new Error('Error! Media is not configured. No task management is available.')
  }
  debug('configuring media ...', config.host, config.path)
  app.use(`${config?.path}/:service/:id`, [
    function (req: Request, res: Response, next: NextFunction) {
      if (config.services?.indexOf(req.params.service) === -1) {
        return res.status(400).json({ message: 'Bad param service' })
      }

      if (!/^\d+$/.test(req.params.id)) {
        return res.status(400).json({ message: 'Bad param id' })
      }
      next()
    },
    // authenticate token!
    // authenticate('jwt'),
    async function (req: Request, res: Response<any, ResponseLocals>, next: NextFunction) {
      if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Origin', '*')
        res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        return res.status(200).send()
      }
      debug('authenticating token ...', req.params.id, req.headers.authorization)
      const token = req.headers.authorization
      if (!token || !token.startsWith('Bearer ')) {
        debug('missing or invalid authorization token')
        return res.status(401).json({ message: 'Missing or invalid authorization token' })
      }
      const authToken = token.split(' ')[1]
      const payload = await app.service('authentication').create({ strategy: 'jwt', accessToken: authToken })
      // Authenticate the token here using your authentication logic
      // For example, you can use a JWT library to verify the token
      // and extract the user information from it
      res.locals.user = payload.user
      next()
    },
    function (req: Request, res: Response<any, ResponseLocals>, next: NextFunction) {
      if (!res.locals.user) {
        return res.status(401).json({ message: 'Unauthorized' })
      }
      debug(
        `[${req.params.service}:${req.params.id}] Call ${req.params.service}.get using user uid: ${res.locals.user.uid}`
      )
      // a class having an attachment
      app
        .service(req.params.service)
        .get(req.params.id, {
          user: res.locals.user,
        } as any)
        .then((item: Job) => {
          res.locals.item = item
          debug(`[${req.params.service}:${req.params.id}]  ${req.params.service}.get success, check attachments...`)
          if (!item.attachment) {
            throw new NotFound()
          }
          next()
        })
        .catch((err: Error) => {
          return res.status((err as any).code || 500).json({ message: err.message })
        })
    },
    function (req: Request, res: Response<any, ResponseLocals>) {
      if (res.locals?.item?.attachment == null) throw new Error('No attachment found')
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
