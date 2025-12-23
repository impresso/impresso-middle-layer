import { AuthorizationBitmapsDTO, AuthorizationBitmapsKey } from '@/models/authorization.js'
import { asObjectOrUndefined } from '@/models/content-item.js'
import {
  ContentItemMention,
  ContentItemNamedEntity,
  ContentItem as ContentItemPrivate,
  ContentItemText,
  ContentItemTopic,
} from '@/models/generated/schemas/contentItem.js'
import {
  ContentItem as ContentItemPublic,
  EntityMention,
  NamedEntity,
  TopicMention,
} from '@/models/generated/schemasPublic.js'
import { base64BytesToBigInt, OpenPermissions } from '@/util/bigint.js'

const toType = (input: ContentItemText['itemType']): ContentItemPublic['type'] => {
  if (input == null || input.trim() === '') return 'ar'
  return input
}

const toNamedEntity = (entity: ContentItemNamedEntity): NamedEntity => ({
  uid: entity.id!,
  count: entity.count ?? 0,
})

const toMention = (mention: ContentItemMention): EntityMention | undefined => {
  if (mention.surfaceForm != null && mention.mentionConfidence != null)
    return {
      ...mention,
      surfaceForm: mention.surfaceForm,
      mentionConfidence: mention.mentionConfidence,
    }
  return undefined
}

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

  const entities = asObjectOrUndefined({
    locations: input.semanticEnrichments?.namedEntities?.locations?.map(toNamedEntity) ?? [],
    persons: input.semanticEnrichments?.namedEntities?.persons?.map(toNamedEntity) ?? [],
    organisations: input.semanticEnrichments?.namedEntities?.organisations?.map(toNamedEntity) ?? [],
    newsAgencies: input.semanticEnrichments?.namedEntities?.newsagencies?.map(toNamedEntity) ?? [],
  })
  const mentions = asObjectOrUndefined({
    locations: input.semanticEnrichments?.mentions?.locations?.map(toMention)?.filter(v => v != null) ?? [],
    persons: input.semanticEnrichments?.mentions?.persons?.map(toMention)?.filter(v => v != null) ?? [],
    organisations: input.semanticEnrichments?.mentions?.organisations?.map(toMention)?.filter(v => v != null) ?? [],
    newsAgencies: input.semanticEnrichments?.mentions?.newsagencies?.map(toMention)?.filter(v => v != null) ?? [],
  })

  return {
    uid: input.id,
    ...(input.relevanceScore != null ? { relevanceScore: input.relevanceScore } : {}),
    copyrightStatus: input.access?.copyright,
    type: toType(input.text?.itemType),
    sourceMedium: input.meta?.sourceMedium,
    title: input.text?.title,
    transcript: input.text?.content,
    ...(entities != null ? { entities } : {}),
    ...(mentions != null ? { mentions } : {}),
    topics:
      input.semanticEnrichments?.topics
        ?.map(toTopicMention)
        ?.filter(v => v != null)
        .map(v => v as TopicMention) ?? [],
    embeddings: input.semanticEnrichments?.embeddings,
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
    hasOLR: input.semanticEnrichments?.ocrQuality != null,
    ocrQualityScore: input.semanticEnrichments?.ocrQuality,
    pageNumbers: input.image?.pages?.map(p => p.number).filter(n => n != null) ?? [],
    collectionUids: input.semanticEnrichments?.collections?.map(c => c.uid) ?? [],

    // Authorization information
    [AuthorizationBitmapsKey]: {
      explore: BigInt((bmExplore ? base64BytesToBigInt(bmExplore) : undefined) ?? OpenPermissions),
      getTranscript: BigInt((bmGetTranscript ? base64BytesToBigInt(bmGetTranscript) : undefined) ?? OpenPermissions),
      getImages: BigInt((bmGetImages ? base64BytesToBigInt(bmGetImages) : undefined) ?? OpenPermissions),
      getAudio: BigInt((bmGetAudio ? base64BytesToBigInt(bmGetAudio) : undefined) ?? OpenPermissions),
    } satisfies AuthorizationBitmapsDTO,
  }
}
