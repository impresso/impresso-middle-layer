import { HookContext, HookFunction } from '@feathersjs/feathers'
import { FindResponse } from '../models/common'
import { ImpressoApplication } from '../types'
import { Redactable, RedactionPolicy, redactObject } from '../util/redaction'
import { SlimUser } from '../authentication'
import { AuthorizationBitmapsDTO, AuthorizationBitmapsKey, isAuthorizationBitmapsDTO } from '../models/authorization'

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

      context.result = redactObject(context.result, policy)
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
      if (dataItemsField != null) {
        const result = context.result as Record<string, any>
        result[dataItemsField] = result[dataItemsField].map((item: Redactable) => {
          if (condition != null && !condition(context, item)) return item
          else return redactObject(item, policy)
        })
      } else {
        const result = context.result as any as FindResponse<Redactable>
        result.data = result.data.map(item => {
          if (condition != null && !condition(context, item)) return item
          else return redactObject(item, policy)
        })
      }
    }
    return context
  }
}

/**
 * Below are conditions that can be used in the redactResponse hook.
 */
export const inPublicApi: RedactCondition = (context, _) => {
  return context.app.get('isPublicApi') == true
}

/**
 * Condition is:
 *  - user is not authenticated
 *  - OR user is authenticated and is not in the specified group
 */
export const notInGroup =
  (groupName: string): RedactCondition =>
  (context, _) => {
    const user = context.params?.user as any as SlimUser
    return user == null || !user.groups.includes(groupName)
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

  const userBitmap: bigint | undefined = BigInt(user.bitmap ?? 0)

  const contentBitmap: bigint | undefined =
    contentBitmapExtractor != null && redactable != null ? contentBitmapExtractor(redactable) : undefined

  if (
    userBitmap == null ||
    contentBitmap == null ||
    !(typeof userBitmap == 'bigint') ||
    !(typeof contentBitmap == 'bigint')
  )
    return false

  return (contentBitmap & userBitmap) != BigInt(0)
}

/**
 * Default condition we should currently use:
 * - running as Public API
 * - AND user is not in the NoRedaction group
 */
export const defaultCondition: RedactCondition = (context, redactable) => {
  return inPublicApi(context, redactable) && !bitmapsAlign(context, redactable)
}

export type { RedactionPolicy }

const authBitmapExtractor = (redactable: Redactable, kind: keyof AuthorizationBitmapsDTO) => {
  const authorizationBitmapDto = redactable[AuthorizationBitmapsKey]
  if (isAuthorizationBitmapsDTO(authorizationBitmapDto)) {
    return authorizationBitmapDto[kind] ?? BigInt(0)
  }
  return BigInt(0)
}

/**
 * condition that grants user access to content (transcript, title).
 */
export const publicApiTranscriptRedactionCondition: RedactCondition = (context, redactable) => {
  return (
    inPublicApi(context, redactable) && !bitmapsAlign(context, redactable, x => authBitmapExtractor(x, 'getTranscript'))
  )
}

const webappAuthBitmapExtractor = (redactable: Redactable, kind: keyof AuthorizationBitmapsDTO) => {
  const actualKey = `bitmap${kind.charAt(0).toUpperCase() + kind.slice(1)}`
  return redactable[actualKey] ?? BigInt(0)
}

export const webAppTranscriptRedactionCondition: RedactCondition = (context, redactable) => {
  return (
    !inPublicApi(context, redactable) &&
    !bitmapsAlign(context, redactable, x => webappAuthBitmapExtractor(x, 'getTranscript'))
  )
}
