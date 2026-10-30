import { HookContext } from '@feathersjs/feathers'
import { authenticateAround as authenticate } from '@/hooks/authenticate.js'
import { queryWithCommonParams } from '@/hooks/params.js'
import { BadRequest } from '@feathersjs/errors'
import type { SpecialMembershipAccessMetadata } from '@/models/special-membership-access.model.js'

const ALLOWED_METADATA_KEYS: (keyof SpecialMembershipAccessMetadata)[] = [
  'modality',
  'enableTemporaryAutomaticApproval',
  'revokeAfterDays',
  'revokeTemporaryAutomaticApprovalAfterDays',
  'emailExtraMessageHtml',
  'emailExtraMessageText',
]

export const validateBitmapPositionsQuery = () => async (context: HookContext) => {
  const bitmapPositions = context.params?.query?.bitmapPositions

  if (bitmapPositions == null) {
    return context
  }

  const rawValues = Array.isArray(bitmapPositions) ? bitmapPositions : [bitmapPositions]
  const normalizedValues = rawValues.flatMap(value =>
    typeof value === 'string' ? value.split(',').map(item => item.trim()) : [value]
  )

  if (
    normalizedValues.length === 0 ||
    normalizedValues.some(value => value === '' || !Number.isInteger(Number(value)))
  ) {
    throw new BadRequest('`bitmapPositions` must be an array of integers')
  }

  if (!context.params.sanitized) {
    context.params.sanitized = {}
  }

  context.params.sanitized.bitmapPositions = normalizedValues.map(value => Number(value))

  return context
}

// Validates patch payload against the `SpecialMembershipAccessMetadata` shape defined in the model.
export const validatePatchMetadata = () => async (context: HookContext) => {
  const data = (context.data ?? {}) as { metadata?: SpecialMembershipAccessMetadata }
  const patchKeys = Object.keys(data)

  if (patchKeys.length === 0) {
    throw new BadRequest('metadata is required')
  }
  if (patchKeys.some(key => key !== 'metadata')) {
    throw new BadRequest('Only metadata can be updated')
  }

  const { metadata } = data
  if (metadata == null) {
    return context
  }

  if (typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new BadRequest('`metadata` must be an object')
  }

  const invalidKeys = Object.keys(metadata).filter(
    key => !ALLOWED_METADATA_KEYS.includes(key as keyof SpecialMembershipAccessMetadata)
  )
  if (invalidKeys.length > 0) {
    throw new BadRequest(`Invalid metadata field(s): ${invalidKeys.join(', ')}`)
  }

  if (metadata.modality != null && !['cc_reviewer', 'notify_reviewer'].includes(metadata.modality)) {
    throw new BadRequest('`metadata.modality` must be one of "cc_reviewer", "notify_reviewer"')
  }
  if (
    metadata.enableTemporaryAutomaticApproval != null &&
    typeof metadata.enableTemporaryAutomaticApproval !== 'boolean'
  ) {
    throw new BadRequest('`metadata.enableTemporaryAutomaticApproval` must be a boolean')
  }
  if (metadata.revokeAfterDays != null && !Number.isInteger(metadata.revokeAfterDays)) {
    throw new BadRequest('`metadata.revokeAfterDays` must be an integer or null')
  }
  if (
    metadata.revokeTemporaryAutomaticApprovalAfterDays != null &&
    !Number.isInteger(metadata.revokeTemporaryAutomaticApprovalAfterDays)
  ) {
    throw new BadRequest('`metadata.revokeTemporaryAutomaticApprovalAfterDays` must be an integer or null')
  }
  if (metadata.emailExtraMessageHtml != null && typeof metadata.emailExtraMessageHtml !== 'string') {
    throw new BadRequest('`metadata.emailExtraMessageHtml` must be a string or null')
  }
  if (metadata.emailExtraMessageText != null && typeof metadata.emailExtraMessageText !== 'string') {
    throw new BadRequest('`metadata.emailExtraMessageText` must be a string or null')
  }

  return context
}

export default {
  around: {
    all: [authenticate({ allowUnauthenticated: true })],
  },
  before: {
    find: [validateBitmapPositionsQuery(), queryWithCommonParams()],
    patch: [validatePatchMetadata()],
  },
}
