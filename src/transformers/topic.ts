import { Topic as TopicInternal } from '../models/generated/schemas'
import { Topic as TopicPublic } from '../models/generated/schemasPublic'

export const transformTopic = (input: TopicInternal): TopicPublic => {
  const { uid, language, countItems, words, model } = input
  return {
    uid,
    language,
    contentItemsCount: countItems,
    words,
    model,
  }
}
