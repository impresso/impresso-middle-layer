import { Collection as CollectionInternal } from '../models/generated/schemas'
import { Collection as CollectionPublic } from '../models/generated/schemasPublic'

const toAccessLevel = (status: string): CollectionPublic['accessLevel'] => {
  switch (status.toUpperCase()) {
    case 'PUB':
      return 'public'
    default:
      return 'private'
  }
}

export const transformCollection = (input: CollectionInternal): CollectionPublic => {
  return {
    uid: input.uid,
    title: input.name,
    description: input.description,
    createdAt: input.creationDate,
    updatedAt: input.lastModifiedDate,
    totalItems: Number(input.countItems),
    accessLevel: toAccessLevel(input.status),
  }
}
