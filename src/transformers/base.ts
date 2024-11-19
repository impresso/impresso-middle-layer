import { BaseFind } from '../models/generated/schemas'
import { BaseFindResponse as BaseFindPublic } from '../models/generated/schemasPublic'

export const transformBaseFind = (input: BaseFind): BaseFindPublic => {
  return {
    pagination: {
      total: input.total,
      limit: input.limit,
      offset: input.offset,
    },
    data: input.data,
  }
}
