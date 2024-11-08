import { ContentItem as ContentItemPrivate, Entity, ContentItemTopic } from '../models/generated/schemas'
import { ContentItem as ContentItemPublic, EntityMention, TopicMention } from '../models/generated/schemasPublic'

const toType = (input: string): ContentItemPublic['type'] => {
  if (input == null || input.trim() === '') return 'ar'
  return input
}

const toEntityMention = (entity: Entity): EntityMention => ({
  uid: entity.uid,
  relevance: entity.relevance,
})

const toTopicMention = (topic: ContentItemTopic): TopicMention | undefined => {
  if (topic.topicUid == null) return undefined
  return {
    uid: topic.topicUid,
    relevance: topic.relevance,
  }
}

export const transformContentItem = (input: ContentItemPrivate): ContentItemPublic => {
  return {
    uid: input.uid,
    type: toType(input.type),
    title: input.title,
    transcript: input.content ?? '',
    locations: input.locations?.map(toEntityMention) ?? [],
    persons: input.persons?.map(toEntityMention) ?? [],
    topics: input.topics?.map(toTopicMention)?.filter(v => v != null) ?? [],
    transcriptLength: input.size ?? 0,
    totalPages: input.nbPages,
    languageCode: input.language?.toLowerCase(),
    isOnFrontPage: input.isFront ?? false,
    publicationDate: input.date as string, // This should always be present
    countryCode: input.country?.toUpperCase(),
    dataProviderCode: input.dataProvider != null ? input.dataProvider : undefined,
    mediaCode: input.newspaper?.uid,
    mediaType: 'newspaper',
  }
}
