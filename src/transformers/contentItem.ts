import { ContentItem as ContentItemPrivate } from '../models/generated/schemas'
import { ContentItem as ContentItemPublic } from '../models/generated/schemasPublic'

const toType = (input: string): ContentItemPublic['type'] => {
  switch (input) {
    case 'ar':
      return 'article'
    case 'ad':
      return 'advert'
    case 'ob':
      return 'obituary'
    default:
      return 'article'
  }
}

export const transformContentItem = (input: ContentItemPrivate): ContentItemPublic => {
  return {
    uid: input.uid,
    title: input.title,
    type: toType(input.type),
  }
}
