import { HookContext, HookFunction } from '@feathersjs/feathers'
import { FindResponse } from '../models/common'
import { ImpressoApplication } from '../types'
import { Redactable, RedactionPolicy, redactObject } from '../util/redaction'
import { SlimUser } from '../authentication'
import { AuthorizationBitmapsDTO, AuthorizationBitmapsKey, isAuthorizationBitmapsDTO } from '../models/authorization'
import { BufferUserPlanGuest } from '../models/user-bitmap.model'
import { OpenPermissions, bitmapsAlign as bitmapsAlignCheck } from '../util/bigint'

export type RedactCondition = (context: HookContext<ImpressoApplication>, redactable?: Redactable) => boolean

/**
 * Redact the response object using the provided redaction policy.
 * If the condition is provided, the redaction will only be applied if the condition is met.
 */
export const redactResponse = <S>(
  policy: RedactionPolicy,
  condition?: (context: HookContext<ImpressoApplication>, redactable: Redactable) => boolean
): HookFunction<ImpressoApplication, S> => {
  return context => {
    if (context.type != 'after') throw new Error('The redactResponse hook should be used as an after hook only')
    if (context.result != null) {
      if (condition != null && !condition(context, context.result)) return context
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
 */
export const redactResponseDataItem = <S>(
  policy: RedactionPolicy,
  condition?: (context: HookContext<ImpressoApplication>, redactable: Redactable) => boolean,
  dataItemsField?: string
): HookFunction<ImpressoApplication, S> => {
  return context => {
    if (context.type != 'after') throw new Error('The redactResponseDataItem hook should be used as an after hook only')

    if (context.result != null) {
      const rules = context.app.get('images').rewriteRules
      if (dataItemsField != null) {
        const result = context.result as Record<string, any>
        result[dataItemsField] = result[dataItemsField].map((item: Redactable) => {
          if (condition != null && !condition(context, item)) return item
          else return redactObject(item, policy, rules)
        })
      } else {
        const result = context.result as any as FindResponse<Redactable>
        result.data = result.data.map(item => {
          if (condition != null && !condition(context, item)) return item
          else return redactObject(item, policy, rules)
        })
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
