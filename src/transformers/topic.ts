import { InternalTopic } from '@/models/generated/deprecated/models.js'
import { Topic as TopicPublic } from '@/models/generated/canonical.js'

export const transformTopic = (input: InternalTopic): TopicPublic => {
  const { uid, language, contentItemsCount, words, model } = input
  return {
    id: uid,
    language,
    contentItemsCount: contentItemsCount,
    words,
    model,
  }
}
