import type { NextFunction, Request, Response } from 'express'
// brings in the `res.hook` augmentation of the Express Response type
import type {} from '@feathersjs/express'
import onHeaders from 'on-headers'
import type { SlimUser } from '@/authentication.js'

export const UserIdHeader = 'X-User-Id'

/**
 * Returns the uid of the user authenticated by the Feathers service call
 * that handled this response, if any.
 *
 * `res.hook` is set by the Feathers REST transport to the hook context of the
 * service call before the call runs, and the same context object is updated
 * as hooks run. It is therefore available on both success and error responses.
 */
export const getAuthenticatedUserId = (res: Response): string | undefined => {
  const user: Partial<SlimUser> | undefined = res.hook?.params?.user
  const uid = user?.uid
  return typeof uid === 'string' && uid.length > 0 ? uid : undefined
}

/**
 * Express middleware that adds the authenticated user's uid to the response
 * in the `X-User-Id` header.
 *
 * The value comes from a token the middle layer has already verified, so a
 * reverse proxy (nginx) can log it (`$upstream_http_x_user_id`) and strip it
 * before it reaches the client (`proxy_hide_header X-User-Id;`).
 *
 * The header is set right before the headers are written, so it covers
 * errors raised after authentication (e.g. 429, 404) as well as successes.
 * A user id sent by the client in a request header is never used.
 */
export const userIdHeader = () => (_req: Request, res: Response, next: NextFunction) => {
  onHeaders(res, () => {
    const userId = getAuthenticatedUserId(res)
    if (userId != null) res.setHeader(UserIdHeader, userId)
  })
  next()
}
