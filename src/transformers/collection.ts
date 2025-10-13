import { Collection as CollectionInternal } from '../models/generated/schemas'
import { Collection as CollectionPublic } from '../models/generated/schemasPublic'

export const transformCollection = (input: CollectionInternal): CollectionPublic => {
  const { creatorId, ...rest } = input
  return rest
}
