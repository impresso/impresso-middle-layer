import type { Application as ExpressApplication } from '@feathersjs/express'
import type { Request, Response } from 'express'
import { FeathersError, type GeneralError } from '@feathersjs/errors'

import { errorHandler } from '@feathersjs/express'
import type { ImpressoApplication } from '../types'
import { logger } from '../logger'

const DefaultProblemUriBase = 'https://impresso-project.ch/probs'

// https://datatracker.ietf.org/doc/html/rfc7807#section-3.1
interface Problem {
  /**
   * A URI reference [RFC3986] that identifies the
   * problem type.  This specification encourages that, when
   * dereferenced, it provide human-readable documentation for the
   * problem type (e.g., using HTML [W3C.REC-html5-20141028]).  When
   * this member is not present, its value is assumed to be
   * "about:blank".
   */
  type: string

  /**
   * A short, human-readable summary of the problem
   * type.  It SHOULD NOT change from occurrence to occurrence of the
   * problem, except for purposes of localization (e.g., using
   * proactive content negotiation; see [RFC7231], Section 3.4).
   */
  title: string

  /**
   * The HTTP status code ([RFC7231], Section 6)
   * generated by the origin server for this occurrence of the problem.
   */
  status: number

  /**
   * A human-readable explanation specific to this
   * occurrence of the problem.
   */
  detail?: string
}

export default (app: ImpressoApplication & ExpressApplication) => {
  const isProduction = process.env.NODE_ENV === 'production'
  const problemUriBase = app.get('problemUriBase') ?? DefaultProblemUriBase

  app.use(
    errorHandler({
      json: {
        404: (err: GeneralError, req: Request, res: Response) => {
          delete err.stack
          res.json({
            type: `${problemUriBase}/not-found`,
            title: 'Item not found',
            status: 404,
          } satisfies Problem)
        },
        500: (err: GeneralError, req: Request, res: Response) => {
          if (isProduction) {
            delete err.stack
          } else {
            logger.error('Error [500]', err)
          }
          res.json({
            type: `${problemUriBase}/internal-error`,
            title: 'Internal server error',
            status: 500,
          } satisfies Problem)
        },
        401: (err: GeneralError, req: Request, res: Response) => {
          res.json({
            type: `${problemUriBase}/unauthorized`,
            title: 'Access to this resource requires authentication',
            status: 401,
            detail: `${err.name}: ${err.message}`,
          } satisfies Problem)
        },
        403: (err: GeneralError, req: Request, res: Response) => {
          res.json({
            type: `${problemUriBase}/unauthorized`,
            title: 'Access to this resource is forbidden',
            status: 403,
            detail: `${err.name}: ${err.message}`,
          } satisfies Problem)
        },
        // bad request
        400: (err: GeneralError, req: Request, res: Response) => {
          if (isProduction) {
            delete err.stack
          } else {
            logger.error('Error [400]', err.data || err)
          }
          res.json({
            type: `${problemUriBase}/bad-request`,
            title: 'Incorrect request parameters',
            status: 400,
            detail: `${err.name}: ${err.message}`,
          } satisfies Problem)
        },
        default: (err: GeneralError, req: Request, res: Response) => {
          // handle all other errors
          logger.error('Error [default]', err)
          delete err.stack

          if (err instanceof FeathersError) {
            return res.json({
              type: `${problemUriBase}/unclassified-error`,
              title: 'An unclassified error occurred',
              status: err.code,
              detail: err.message,
            } satisfies Problem)
          }

          res.json({
            type: `${problemUriBase}/unclassified-error`,
            title: 'An unclassified error occurred',
            status: (err as GeneralError).code ?? 500,
            detail: (err as GeneralError).message,
          } satisfies Problem)
        },
      },
    })
  )
}
