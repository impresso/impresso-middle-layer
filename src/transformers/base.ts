import { BaseFind } from '@/models/generated/deprecated/internalApi.js'
import { BaseFindResponse as BaseFindPublic } from '@/models/generated/app/responses.js'

interface NextCursorMarkMixin {
  nextCursorMark?: string
}

export const transformBaseFind = (input: BaseFind & NextCursorMarkMixin): BaseFindPublic & NextCursorMarkMixin => {
  return {
    pagination: {
      total: input.total,
      limit: input.limit,
      offset: input.offset,
    },
    data: input.data,
    nextCursorMark: input.nextCursorMark,
  }
}
