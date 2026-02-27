import { Collection as CollectionInternal } from '@/models/generated/canonical.js'
import { Collection as CollectionPublic } from '@/models/generated/schemasPublic.js'

export const transformCollection = (input: CollectionInternal): CollectionPublic => {
  const { creatorId, ...rest } = input
  return rest
}
