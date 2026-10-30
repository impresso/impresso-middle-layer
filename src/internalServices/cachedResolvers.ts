import { createEntityResolver } from '@/services/entities/lookup.js'
import Topic from '@/models/topics.model.js'
import { ImpressoApplication } from '@/types.js'
import { getWellKnownSnapshots } from '@/internalServices/wellKnownSnapshots.js'
import { getPartnerResolver } from '@/internalServices/facetResolvers/partnerResolver.js'
import {
  Topic as ITopic,
  Year as IYear,
  Entity as IEntity,
  Collection as ICollection,
  Partner as IPartner,
  MediaSource as IMediaSource,
} from '@/models/generated/app/entities.js'
import { FacetWithLabel } from '@/models/generated/app/entities.js'
import { ImageTypeValueLookup } from '@/services/images/images.class.js'
import SpecialMembershipAccess from '@/models/special-membership-access.model.js'
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
  | 'specialMembershipAccess'
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
  specialMembershipAccess: IResolver<SpecialMembershipAccess>
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
  dsc: 'Discussion',
  ent: 'Entertainment',
  'no-type': 'Unknown type',
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

const getTopicResolver = (app: ImpressoApplication): IResolver<ITopic> => {
  return async (id: string) => {
    const topics = await getWellKnownSnapshots(app.get('cacheManager')).topics()
    const topic = topics.get(id)
    return topic == null ? undefined : new Topic(structuredClone(topic))
  }
}

const getYearResolver = (app: ImpressoApplication): IResolver<IYear> => {
  return async (id: string) => {
    const years = await getWellKnownSnapshots(app.get('cacheManager')).years()
    const year = years.get(String(Number(id)))
    return year == null ? undefined : { ...structuredClone(year), id: Number(id) }
  }
}

const getMediaSourceResolver = (app: ImpressoApplication): IResolver<IMediaSource> => {
  const mediaSources = app.service('media-sources')
  return async (id: string) => {
    return mediaSources.getMediaSource(id)
  }
}

const getSpecialMembershipResolver = (app: ImpressoApplication): IResolver<SpecialMembershipAccess> => {
  const service = app.service('special-membership-plans')

  return async (bitmapPosition: string) => {
    const trimmed = bitmapPosition.trim()
    if (trimmed === '') return undefined
    const parsedBitmapPosition = Number(trimmed)
    if (!Number.isInteger(parsedBitmapPosition) || parsedBitmapPosition < 0) return undefined
    const lookup = await service.getLookup()
    const cached = lookup[String(parsedBitmapPosition)]
    if (cached != null) {
      return cached as unknown as SpecialMembershipAccess
    }
    const result = await service.getByBitmapPosition(parsedBitmapPosition)
    return result
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
  const resolveEntity = createEntityResolver(app)
  const entityResolver: IResolver<IEntity> = async id => {
    const entity = await resolveEntity(id)
    return entity == null ? undefined : { ...entity, relevance: 0 }
  }
  return {
    collection: getCollectionResolver(app),
    location: entityResolver,
    person: entityResolver,
    topic: getTopicResolver(app),
    year: getYearResolver(app),
    mediaSource: getMediaSourceResolver(app),
    partner: getPartnerResolver(app),
    nag: entityResolver,
    organisation: entityResolver,
    imageVisualContent: (id: string) => imageTypeResolver(id, 'type_l0_tp'),
    imageTechnique: (id: string) => imageTypeResolver(id, 'type_l1_tp'),
    imageCommunicationGoal: (id: string) => imageTypeResolver(id, 'type_l2_tp'),
    imageContentType: (id: string) => imageTypeResolver(id, 'type_l3_tp'),
    dataDomain: getDataDomainResolver(),
    copyright: getCopyrightResolver(),
    contentItemType: getContentItemTypeResolver(),
    specialMembershipAccess: getSpecialMembershipResolver(app),
  }
}
