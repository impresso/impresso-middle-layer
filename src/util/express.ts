import { Request, Response, NextFunction, Send } from 'express'
import { safeParseJson, safeStringifyJson } from './jsonCodec'

/**
 * Custom JSON middleware for Express.
 * It handles JSON parsing and stringifying using a custom JSON parser
 * that supports BigInts.
 */
export const customJsonMiddleware = () => {
  return (req: Request, res: Response, next: NextFunction) => {
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
      req.setEncoding('utf8')
      req.on('data', chunk => {
        data += chunk
      })

      req.on('end', () => {
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
