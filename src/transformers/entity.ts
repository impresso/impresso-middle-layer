import { EntityDetails } from '../models/generated/schemas'
import { EntityDetails as EntityDetailsPublic } from '../models/generated/schemasPublic'

export const transformEntityDetails = (input: EntityDetails): EntityDetailsPublic => {
  return {
    uid: input.uid,
    label: input.name,
    totalContentItems: input.countItems,
    totalMentions: input.countMentions,
    type: input.type,
    wikidataId: input.wikidataId,
  }
}
