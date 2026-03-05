import Entity from '@/models/entities.model.js'
import Topic from '@/models/topics.model.js'
import { ImpressoApplication } from '@/types.js'
import { WellKnownKeys } from '@/cache.js'
import { getPartnerResolver } from '@/internalServices/facetResolvers/partnerResolver.js'
import { getNameFromUid } from '@/utils/entity.utils.js'
import {
  Topic as ITopic,
  Year as IYear,
  Entity as IEntity,
  Collection as ICollection,
  Partner as IPartner,
  MediaSource as IMediaSource,
} from '@/models/generated/canonical.js'
import { FacetWithLabel } from '@/models/generated/canonical.js'
import { ImageTypeValueLookup } from '@/services/images/images.class.js'
export type CachedFacetType =
  | 'mediaSource'
  | 'topic'
  | 'person'
  | 'location'
  | 'collection'
  | 'year'
  | 'partner'
  | 'nag'
  | 'organisation'
  | 'imageVisualContent'
  | 'imageTechnique'
  | 'imageCommunicationGoal'
  | 'imageContentType'
  | 'dataDomain'
  | 'copyright'
  | 'contentItemType'
export type CachedFacetTypes = ITopic | IYear | IEntity | ICollection | IMediaSource | IPartner | FacetWithLabel

export type IResolver<T> = (id: string) => Promise<T | undefined>

export type ICachedResolvers = {
  mediaSource: IResolver<IMediaSource>
  topic: IResolver<ITopic>
  person: IResolver<IEntity>
  location: IResolver<IEntity>
  collection: IResolver<ICollection>
  year: IResolver<IYear>
  partner: IResolver<IPartner>
  nag: IResolver<IEntity>
  organisation: IResolver<IEntity>
  imageVisualContent: IResolver<FacetWithLabel>
  imageTechnique: IResolver<FacetWithLabel>
  imageCommunicationGoal: IResolver<FacetWithLabel>
  imageContentType: IResolver<FacetWithLabel>
  dataDomain: IResolver<FacetWithLabel>
  copyright: IResolver<FacetWithLabel>
  contentItemType: IResolver<FacetWithLabel>
}

// Record<CachedFacetType, IResolver<T>>

const DataDomainLabels = {
  pbl: 'Public',
  prt: 'Private',
} as const

const CopyrightLabels = {
  pbl: 'Public domain',
  und: 'Protected domain: copyright undetermined',
  nkn: 'Protected domain: no known copyright',
  euo: 'Protected domain: in copyright - EU orphan work',
  unk: 'Protected domain: in copyright - unknown rightsholders',
  in_cpy: 'Protected domain: in copyright',
} as const

const ContentItemTypeLabels = {
  ar: 'Article',
  ad: 'Advertisement',
  page: 'Page',
  tb: 'Table',
  ob: 'Obituary',
  w: 'Weather',
  chapter: 'Chapter',
  chronicle: 'Chronicle',
  unsegmented: 'Unsegmented',
  radio_broadcast_episode: 'Radio broadcast episode',
  radio_bulletin: 'Radio bulletin',
} as const

const fromLookup =
  (lookup: Record<string, string>): IResolver<FacetWithLabel> =>
  async (id: string) => {
    const label = lookup[id]
    if (label == null) return undefined
    return { id, label } satisfies FacetWithLabel
  }

export const getDataDomainResolver = (): IResolver<FacetWithLabel> => fromLookup(DataDomainLabels)

export const getCopyrightResolver = (): IResolver<FacetWithLabel> => fromLookup(CopyrightLabels)

export const getContentItemTypeResolver = (): IResolver<FacetWithLabel> => fromLookup(ContentItemTypeLabels)

const getCollectionResolver = (app: ImpressoApplication): IResolver<ICollection> => {
  const collectionsService = app.service('collections')
  return async (id: string) => {
    const collection = await collectionsService.getInternal(id)
    return {
      id: id,
      title: collection?.name ?? '',
      description: collection?.description ?? '',
      accessLevel: collection?.status == 'PRI' ? 'private' : 'public',
      creatorId: String(collection?.creatorId),
      createdAt: collection?.creationDate?.toISOString() ?? '',
      updatedAt: collection?.lastModifiedDate?.toISOString() ?? '',
      totalItems: 0,
    } satisfies ICollection
  }
}

const entityResolver = async (id: string, type: CachedFacetType) =>
  new Entity({
    uid: id,
    type,
    name: getNameFromUid(id),
  }) as any as IEntity

const getTopicResolver = (app: ImpressoApplication): IResolver<ITopic> => {
  return async (id: string) => {
    const result = await app.get('cacheManager').get<string>(WellKnownKeys.Topics)
    const deserialisedTopics: ITopic[] = JSON.parse(result ?? '[]')

    const topic = deserialisedTopics.find(t => t.id === id)
    if (!topic) return undefined
    return new Topic(topic as unknown as any) as any as ITopic
  }
}

const getYearResolver = (app: ImpressoApplication): IResolver<IYear> => {
  return async (id: string) => {
    const result = await app.get('cacheManager').get<string>(WellKnownKeys.Years)
    const deserialisedYears: Record<number, IYear> = JSON.parse(result ?? '{}')

    const year = deserialisedYears[Number(id)]
    return year
  }
}

const getMediaSourceResolver = (app: ImpressoApplication): IResolver<IMediaSource> => {
  const mediaSources = app.service('media-sources')
  return async (id: string) => {
    const lookup = await mediaSources.getLookup()
    const item = lookup[id]
    return item
  }
}

const imageTypeResolver = async (id: string, field: keyof typeof ImageTypeValueLookup) => {
  const lookup = ImageTypeValueLookup[field]
  return {
    id,
    label: lookup[id] ?? id,
  } satisfies FacetWithLabel
}

export const buildResolvers = (app: ImpressoApplication): ICachedResolvers => {
  return {
    collection: getCollectionResolver(app),
    location: (id: string) => entityResolver(id, 'location'),
    person: (id: string) => entityResolver(id, 'person'),
    topic: getTopicResolver(app),
    year: getYearResolver(app),
    mediaSource: getMediaSourceResolver(app),
    partner: getPartnerResolver(app),
    nag: (id: string) => entityResolver(id, 'nag'),
    organisation: (id: string) => entityResolver(id, 'organisation'),
    imageVisualContent: (id: string) => imageTypeResolver(id, 'type_l0_tp'),
    imageTechnique: (id: string) => imageTypeResolver(id, 'type_l1_tp'),
    imageCommunicationGoal: (id: string) => imageTypeResolver(id, 'type_l2_tp'),
    imageContentType: (id: string) => imageTypeResolver(id, 'type_l3_tp'),
    dataDomain: getDataDomainResolver(),
    copyright: getCopyrightResolver(),
    contentItemType: getContentItemTypeResolver(),
  }
}
