import { Collection } from '@/models/generated/canonical.js'

type PublicCollection = Omit<Collection, 'creatorId'>

export const transformCollection = (input: Collection): PublicCollection => {
  const { creatorId, ...rest } = input
  return rest
}
