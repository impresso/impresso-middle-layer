import { NotFound } from '@feathersjs/errors'
import { getLogger } from '@/logger.js'
import type { Application as ExpressApplication } from '@feathersjs/express'
import { NextFunction, Request, Response } from 'express'

import Job from '@/models/jobs.model.js'
import User from '@/models/users.model.js'

import { ImpressoApplication } from '@/types.js'

const logger = getLogger(['impresso', 'media'])

interface ResponseLocals {
  user?: User
  item?: Job
}

export default (app: ImpressoApplication & ExpressApplication) => {
  const config = app.get('media')

  if (!config) {
    logger.debug('Error! Media is not configured. No task management is available.')
    throw new Error('Error! Media is not configured. No task management is available.')
  }
  logger.debug(`configuring media ... ${config.host} ${config.path}`)
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
      logger.debug(`authenticating token ... ${req.params.id} ${req.headers.authorization}`)
      const token = req.headers.authorization
      if (!token || !token.startsWith('Bearer ')) {
        logger.debug('missing or invalid authorization token')
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
      logger.debug(`[${req.params.service}:${req.params.id}] Call ${req.params.service}.get using user uid: ${res.locals.user.uid}`)
      // a class having an attachment
      app
        .service(req.params.service)
        .get(req.params.id, {
          user: res.locals.user,
        } as any)
        .then((item: Job) => {
          res.locals.item = item
          logger.debug(`[${req.params.service}:${req.params.id}]  ${req.params.service}.get success, check attachments...`)
          if (!item?.attachment) {
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
      logger.debug(`[${req.params.service}:${req.params.id}] original filepath: ${res.locals.item.attachment.path}`)
      const protectedFilepath = [config.protectedPath, res.locals.item.attachment.path].join('/')
      logger.debug(`[${req.params.service}:${req.params.id}] flush headers for filename: ${filename} ${protectedFilepath}`)
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
