import { InternalTopic } from '@/models/generated/deprecated/models.js'
import { Topic as TopicPublic } from '@/models/generated/canonical.js'

export const transformTopic = (input: InternalTopic): TopicPublic => {
  const { id, language, contentItemsCount, words, model } = input
  return {
    id,
    language,
    contentItemsCount: contentItemsCount,
    words,
    model,
  }
}
