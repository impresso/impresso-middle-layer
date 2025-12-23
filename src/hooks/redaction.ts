import { HookContext, HookFunction } from '@feathersjs/feathers'
import { FindResponse } from '@/models/common.js'
import { ImpressoApplication } from '@/types.js'
import { Redactable, RedactionPolicy, redactObject } from '@/util/redaction.js'
import { SlimUser } from '@/authentication.js'
import { AuthorizationBitmapsDTO, AuthorizationBitmapsKey, isAuthorizationBitmapsDTO } from '@/models/authorization.js'
import { BufferUserPlanGuest } from '@/models/user-bitmap.model.js'
import { OpenPermissions, bitmapsAlign as bitmapsAlignCheck } from '@/util/bigint.js'

export type RedactCondition = (context: HookContext<ImpressoApplication>, redactable?: Redactable) => boolean
export type AsyncRedactCondition = (
  context: HookContext<ImpressoApplication>,
  redactable?: Redactable
) => Promise<boolean>

/**
 * Redact the response object using the provided redaction policy.
 * If the condition is provided, the redaction will only be applied if the condition is met.
 * Supports both sync and async conditions.
 */
export const redactResponse = <S>(
  policy: RedactionPolicy,
  condition?: RedactCondition | AsyncRedactCondition
): HookFunction<ImpressoApplication, S> => {
  return async context => {
    if (context.type != 'after') throw new Error('The redactResponse hook should be used as an after hook only')
    if (context.result != null) {
      if (condition != null) {
        const shouldRedact = await condition(context, context.result)
        if (!shouldRedact) return context
      }
      const rules = context.app.get('images').rewriteRules
      context.result = redactObject(context.result, policy, rules)
    }
    return context
  }
}

/**
 * Redact the response object using the provided redaction policy.
 * Assumes that the response is a FindResponse object (has a `data` field with
 * an array of objects).
 * If the condition is provided, the redaction will only be applied if the condition is met.
 * Supports both sync and async conditions.
 */
export const redactResponseDataItem = <S>(
  policy: RedactionPolicy,
  condition?: RedactCondition | AsyncRedactCondition,
  dataItemsField?: string
): HookFunction<ImpressoApplication, S> => {
  return async context => {
    if (context.type != 'after') throw new Error('The redactResponseDataItem hook should be used as an after hook only')

    if (context.result != null) {
      const rules = context.app.get('images').rewriteRules
      if (dataItemsField != null) {
        const result = context.result as Record<string, any>
        result[dataItemsField] = await Promise.all(
          result[dataItemsField].map(async (item: Redactable) => {
            if (condition != null) {
              const shouldRedact = await condition(context, item)
              if (!shouldRedact) return item
            }
            return redactObject(item, policy, rules)
          })
        )
      } else {
        const result = context.result as any as FindResponse<Redactable>
        result.data = await Promise.all(
          result.data.map(async item => {
            if (condition != null) {
              const shouldRedact = await condition(context, item)
              if (!shouldRedact) return item
            }
            return redactObject(item, policy, rules)
          })
        )
      }
    }
    return context
  }
}

export type BitMapsAlignContext = Pick<HookContext<ImpressoApplication>, 'params'>

/**
 * Condition for redacting fields when the access bitmap of the resource
 * does not align with the access bitmap of the user.
 *
 * If either user of the resource does not have the bitmap, access is not granted.
 */
export const bitmapsAlign = (
  context: BitMapsAlignContext,
  redactable?: Redactable,
  contentBitmapExtractor?: (redactable: Redactable) => bigint
): boolean => {
  const user = context.params?.user as any as SlimUser

  /**
   * If redaction is done in an authenticated context, the user should be present
   * and we use the user's bitmap.
   * If the context is not authenticated, we use the bitmap of a guest user.
   */
  const userBitmap = user?.bitmap ?? BufferUserPlanGuest

  const contentBitmap =
    contentBitmapExtractor != null && redactable != null ? contentBitmapExtractor(redactable) : OpenPermissions

  return bitmapsAlignCheck(contentBitmap, userBitmap)
}

export type { RedactionPolicy }

/**
 * Extractor that works with the public API objects.
 * The public API objects use the AuthorizationBitmapsKey field.
 */
const publicApiAuthBitmapExtractor = (redactable: Redactable, kind: keyof AuthorizationBitmapsDTO) => {
  const authorizationBitmapDto = redactable[AuthorizationBitmapsKey]
  if (isAuthorizationBitmapsDTO(authorizationBitmapDto)) {
    return authorizationBitmapDto[kind] ?? OpenPermissions
  }
  return OpenPermissions
}

/**
 * Extractor that works with older webapp objects.
 * The webapp redaction policies use fields like `bitmapExplore` instead of
 * using the AuthorizationBitmapsKey.
 */
const webAppAuthBitmapExtractor = (redactable: Redactable, kind: keyof AuthorizationBitmapsDTO) => {
  const actualKey = `bitmap${kind.charAt(0).toUpperCase() + kind.slice(1)}`
  const value = redactable[actualKey]
  return value != null ? BigInt(value) : OpenPermissions
}

/**
 * Extractor that works with either objects, autodetecting.
 */

const authBitmapExtractor = (redactable: Redactable, kind: keyof AuthorizationBitmapsDTO) => {
  // Try to use the AuthorizationBitmapsKey first
  if (AuthorizationBitmapsKey in redactable) {
    return publicApiAuthBitmapExtractor(redactable, kind)
  }
  return webAppAuthBitmapExtractor(redactable, kind)
}

/**
 * Condition for redacting parts of the content which says:
 * Redact if the user does NOT have the specified permission.
 *
 * @param kind the kind of permission to check
 * @returns
 */
export const unlessHasPermission = (kind: keyof AuthorizationBitmapsDTO): RedactCondition => {
  return (context, redactable) => {
    return !bitmapsAlign(context, redactable, x => authBitmapExtractor(x, kind))
  }
}

/**
 * Condition for redacting parts of the content which says:
 * Redact if the user does NOT have the specified permission OR has reached their quota.
 *
 * This is an async function because it needs to check the quota from Redis.
 * Returns true (redact) if:
 * - User lacks the permission, OR
 * - User has permission but has exceeded their quota
 *
 * @param kind the kind of permission to check
 * @returns an async condition function
 */
export const unlessHasPermissionAndWithinQuota = (
  kind: keyof AuthorizationBitmapsDTO,
  itemIdField: string = 'id'
): AsyncRedactCondition => {
  return async (context, redactable) => {
    // First check if user has the required permission
    const hasPermission = bitmapsAlign(context, redactable, x => authBitmapExtractor(x, kind))

    if (!hasPermission) {
      // Redact if user doesn't have permission
      return true
    }

    // User has permission, now check if they're within quota
    const user = context.params?.user as any as SlimUser

    if (!user?.id) {
      // No user, cannot check quota - allow access
      return false
    }

    try {
      const quotaChecker = context.app.service('quotaChecker')

      const itemId = (redactable as any)?.[itemIdField]

      if (itemId) {
        const quotaResult = await quotaChecker.check(user.id, itemId)
        // Redact if user has exceeded quota
        return !quotaResult.allowed
      }
    } catch (error) {
      // Log the error but don't block access on quota check failure
      console.error('Error checking quota:', error)
    }

    // If we can't determine quota status, allow access
    return false
  }
}
