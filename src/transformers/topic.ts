import { Topic as TopicPublic } from '@/models/generated/app/entities.js'

export const transformTopic = (input: TopicPublic): TopicPublic => {
  const { id, language, contentItemsCount, words, model } = input
  return {
    id,
    language,
    contentItemsCount: contentItemsCount,
    words,
    model,
  }
}
