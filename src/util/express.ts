import { Request, Response, NextFunction } from 'express'
import type { Readable } from 'node:stream'
import { safeParseJson, safeStringifyJson } from '@/util/jsonCodec.js'
import { FeathersError } from '@feathersjs/errors'

type JsonRequest = Pick<Request, 'is' | 'path' | 'body'> & Pick<Readable, 'setEncoding' | 'on'>

/**
 * Custom JSON middleware for Express.
 * It handles JSON parsing and stringifying using a custom JSON parser
 * that supports BigInts.
 */
export const customJsonMiddleware = (options: { bodyLimits?: Readonly<Record<string, number>> } = {}) => {
  return (req: JsonRequest, res: Response, next: NextFunction) => {
    // Override response.json method
    res.json = function (body: any): Response {
      try {
        res.header('Content-Type', 'application/json')
        return res.send(Buffer.from(safeStringifyJson(body)))
      } catch (error) {
        next(error)
        return this
      }
    }

    // Parse incoming JSON
    if (req.is('application/json')) {
      let data = ''
      let bytes = 0
      let exceeded = false
      const bodyLimit = options.bodyLimits?.[req.path.replace(/\/+$/, '')]
      req.setEncoding('utf8')
      req.on('data', chunk => {
        if (exceeded) return
        bytes += Buffer.byteLength(chunk, 'utf8')
        if (bodyLimit !== undefined && bytes > bodyLimit) {
          exceeded = true
          data = ''
          next(
            new FeathersError(
              `JSON body exceeds ${bodyLimit} bytes`,
              'PayloadTooLarge',
              413,
              'payload-too-large',
              undefined
            )
          )
          return
        }
        data += chunk
      })

      req.on('end', () => {
        if (exceeded) return
        try {
          req.body = safeParseJson(data)
          next()
        } catch (error) {
          next(error)
        }
      })
    } else {
      next()
    }
  }
}
