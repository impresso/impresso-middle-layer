import type { HookContext, NextFunction } from '@feathersjs/feathers'
import { Forbidden } from '@feathersjs/errors'
import type { ImpressoApplication } from '@/types.js'
import type { SlimUser } from '@/authentication.js'

interface ParamsWithUser {
  user?: SlimUser
}

/**
 * Runtime type guard for SlimUser objects stored in context params.
 */
export const isSlimUser = (value: unknown): value is SlimUser => {
  if (!value || typeof value !== 'object') return false
  const user = value as SlimUser
  return (
    typeof user.uid === 'string' &&
    typeof user.id === 'number' &&
    typeof user.isStaff === 'boolean' &&
    typeof user.bitmap === 'bigint' &&
    Array.isArray(user.groups) &&
    user.groups.every(group => typeof group === 'string')
  )
}

/**
 * Hook that permits only staff users (SlimUser.isStaff) to proceed.
 */
export const staffOnly = async (context: HookContext<ImpressoApplication>, next: NextFunction) => {
  const params = context.params as ParamsWithUser
  const user = params?.user

  if (!isSlimUser(user) || !user.isStaff) {
    throw new Forbidden('Staff only')
  }

  await next()
}
