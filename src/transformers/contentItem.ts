import { AuthorizationBitmapsDTO, AuthorizationBitmapsKey } from '../models/authorization'
import {
  ContentItemNamedEntity,
  ContentItem as ContentItemPrivate,
  ContentItemText,
  ContentItemTopic,
} from '../models/generated/schemas/contentItem'
import { ContentItem as ContentItemPublic, NamedEntity, TopicMention } from '../models/generated/schemasPublic'
import { base64BytesToBigInt, OpenPermissions } from '../util/bigint'

const toType = (input: ContentItemText['itemType']): ContentItemPublic['type'] => {
  if (input == null || input.trim() === '') return 'ar'
  return input
}

const toNamedEntity = (entity: ContentItemNamedEntity): NamedEntity => ({
  uid: entity.id!,
  count: entity.count ?? 0,
})

const toTopicMention = (topic: ContentItemTopic): TopicMention | undefined => {
  if (topic.id == null) return undefined
  return {
    uid: topic.id,
    relevance: topic.relevance,
  }
}

export const transformContentItem = (input: ContentItemPrivate): ContentItemPublic => {
  const {
    explore: bmExplore,
    getImages: bmGetImages,
    getTranscript: bmGetTranscript,
    getAudio: bmGetAudio,
  } = input.access?.accessBitmaps ?? {}

  return {
    uid: input.id,
    copyrightStatus: input.access?.copyright,
    type: toType(input.text?.itemType),
    sourceMedium: input.meta?.sourceMedium,
    title: input.text?.title,
    transcript: input.text?.content,
    locationEntities: input.semanticEnrichments?.namedEntities?.locations?.map(toNamedEntity) ?? [],
    personEntities: input.semanticEnrichments?.namedEntities?.persons?.map(toNamedEntity) ?? [],
    organisationEntities: input.semanticEnrichments?.namedEntities?.organisations?.map(toNamedEntity) ?? [],
    newsAgenciesEntities: input.semanticEnrichments?.namedEntities?.newsagencies?.map(toNamedEntity) ?? [],
    topics:
      input.semanticEnrichments?.topics
        ?.map(toTopicMention)
        ?.filter(v => v != null)
        .map(v => v as TopicMention) ?? [],
    transcriptLength: input.text?.contentLength ?? 0,
    totalPages: input.image?.pagesCount ?? 0,
    languageCode: input.text?.langCode?.toLowerCase(),
    isOnFrontPage: input.image?.isFrontPage ?? false,
    publicationDate: input.meta?.date, // This should always be present
    issueUid: input.issueId,
    countryCode: input.meta?.countryCode?.toUpperCase(),
    providerCode: input.meta?.partnerId != null ? input.meta?.partnerId : undefined,
    mediaUid: input.meta?.mediaId,
    mediaType: input.meta?.sourceType,

    // Authorization information
    [AuthorizationBitmapsKey]: {
      explore: BigInt((bmExplore ? base64BytesToBigInt(bmExplore) : undefined) ?? OpenPermissions),
      getTranscript: BigInt((bmGetTranscript ? base64BytesToBigInt(bmGetTranscript) : undefined) ?? OpenPermissions),
      getImages: BigInt((bmGetImages ? base64BytesToBigInt(bmGetImages) : undefined) ?? OpenPermissions),
      getAudio: BigInt((bmGetAudio ? base64BytesToBigInt(bmGetAudio) : undefined) ?? OpenPermissions),
    } satisfies AuthorizationBitmapsDTO,
  }
}
