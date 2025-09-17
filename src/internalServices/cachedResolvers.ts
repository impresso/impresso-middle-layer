import Collection from '../models/collections.model'
import Entity from '../models/entities.model'
import Topic from '../models/topics.model'
import { optionalMediaSourceToNewspaper } from '../services/newspapers/newspapers.class'
import { ImpressoApplication } from '../types'
import { Newspaper as NewspaperInternal } from '../models/generated/schemas'
import { WellKnownKeys } from '../cache'
import { getPartnerResolver } from './facetResolvers/partnerResolver'
import { getNameFromUid } from '../utils/entity.utils'
import {
  Topic as ITopic,
  Year as IYear,
  Entity as IEntity,
  Collection as ICollection,
  Newspaper as INewspaper,
  Partner as IPartner,
} from '../models/generated/schemas'
export type CachedFacetType =
  | 'newspaper'
  | 'topic'
  | 'person'
  | 'location'
  | 'collection'
  | 'year'
  | 'partner'
  | 'nag'
  | 'organisation'
export type CachedFacetTypes = ITopic | IYear | IEntity | ICollection | INewspaper | IPartner

export type IResolver<T> = (id: string) => Promise<T | undefined>

export type ICachedResolvers = {
  newspaper: IResolver<NewspaperInternal>
  topic: IResolver<ITopic>
  person: IResolver<IEntity>
  location: IResolver<IEntity>
  collection: IResolver<ICollection>
  year: IResolver<IYear>
  partner: IResolver<IPartner>
  nag: IResolver<IEntity>
  organisation: IResolver<IEntity>
}

// Record<CachedFacetType, IResolver<T>>

const collectionResolver: IResolver<ICollection> = async (id: string) =>
  new Collection({
    uid: id,
    name: id,
  }) as any as ICollection

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

    const topic = deserialisedTopics.find(t => t.uid === id)
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

const getNewspaperResolver = (app: ImpressoApplication): IResolver<NewspaperInternal> => {
  const mediaSources = app.service('media-sources')
  return async (id: string) => {
    const lookup = await mediaSources.getLookup()
    const item = lookup[id]
    return optionalMediaSourceToNewspaper(item)
  }
}

export const buildResolvers = (app: ImpressoApplication): ICachedResolvers => {
  return {
    collection: collectionResolver,
    location: (id: string) => entityResolver(id, 'location'),
    person: (id: string) => entityResolver(id, 'person'),
    topic: getTopicResolver(app),
    year: getYearResolver(app),
    newspaper: getNewspaperResolver(app),
    partner: getPartnerResolver(app),
    nag: (id: string) => entityResolver(id, 'nag'),
    organisation: (id: string) => entityResolver(id, 'organisation'),
  }
}
