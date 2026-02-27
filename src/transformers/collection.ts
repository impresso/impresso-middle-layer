import { Collection as CollectionInternal } from '@/models/generated/canonical.js'
import { PublicCollection } from '@/models/generated/schemasPublic.js'

export const transformCollection = (input: CollectionInternal): PublicCollection => {
  const { creatorId, ...rest } = input
  return rest
}
