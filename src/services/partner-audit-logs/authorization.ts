import { Forbidden } from '@feathersjs/errors'
import type { SlimUser } from '@/authentication.js'

/**
 * Check whether the user is allowed to download the audit logs of the
 * given data provider.
 *
 * NOTE: proper authorization will be implemented later. For now only
 * staff members are allowed through as a temporary policy.
 */
export const authorizePartnerAuditLogAccess = async (
  user: SlimUser | undefined,
  // eslint-disable-next-line no-unused-vars
  providerId: string
): Promise<void> => {
  if (!user?.isStaff) throw new Forbidden('User is not authorized to access partner audit logs')
}
