import type { Application as ExpressApplication } from '@feathersjs/express'
import { json, rest, urlencoded } from '@feathersjs/express'
import cors from 'cors'
import { ImpressoApplication } from '../types'

import socketio from '@feathersjs/socketio'
import { logger } from '../logger'

export default (app: ImpressoApplication & ExpressApplication) => {
  const isPublicApi = app.get('isPublicApi')

  if (isPublicApi) {
    logger.info('Public API - enabling REST transport')
    // Turn on JSON parser for REST services
    app.use(json())
    // Turn on URL-encoded parser for REST services
    app.use(urlencoded({ extended: true }))
    app.configure(rest())

    const allowedCorsOrigins = app.get('allowedCorsOrigins')

    const origin = (requestOrigin: string | undefined, callback: (err: Error | null, origin?: string) => void) => {
      const notAllowed =
        allowedCorsOrigins === undefined || requestOrigin === undefined || !allowedCorsOrigins.includes(requestOrigin)
      if (notAllowed) return callback(new Error('Not allowed by CORS'))
      return callback(null, requestOrigin)
    }

    app.use(
      cors({
        origin: allowedCorsOrigins ?? [],
      })
    )
  } else {
    logger.info('Internal API - enabling socketio transport')

    void app.configure(
      socketio(
        {
          allowEIO3: true,
          cors: {
            credentials: true,
          },
        },
        io => {
          logger.debug('registering socketio handler')
          io.on('connection', socket => {
            logger.debug('socket connected')
          })
          io.on('disconnect', socket => {
            // Do something here
            logger.debug('socket disconnected')
          })

          // Registering Socket.io middleware
          io.use(function (socket, next) {
            // Exposing a request property to services and hooks
            ;(socket as any).feathers.referrer = (socket.request as any).referrer
            next()
          })
        }
      )
    )
  }
}
