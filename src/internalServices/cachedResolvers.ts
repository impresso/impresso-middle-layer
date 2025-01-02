import Collection from '../models/collections.model'
import Entity from '../models/entities.model'
import Topic from '../models/topics.model'
import Year from '../models/years.model'
import { optionalMediaSourceToNewspaper } from '../services/newspapers/newspapers.class'
import { ImpressoApplication } from '../types'
import { Newspaper as NewspaperInternal } from '../models/generated/schemas'

export type CachedFacetType = 'newspaper' | 'topic' | 'person' | 'location' | 'collection' | 'year'

type IResolver<T> = (id: string, type: CachedFacetType) => Promise<T | undefined>

export type ICachedResolvers = Record<CachedFacetType, IResolver<any>>

const collectionResolver: IResolver<Collection> = async (id: string, _) =>
  new Collection({
    uid: id,
    name: id,
  })

const entityResolver: IResolver<Entity> = async (id: string, type: CachedFacetType) =>
  new Entity({
    uid: id,
    type,
    name: Entity.getNameFromUid(id),
  })

const topicResolver: IResolver<Topic> = async (id: string, _) => Topic.getCached(id)

const yearResolver: IResolver<Year> = async (id: string, _) => Year.getCached(id)

const getNewspaperResolver = (app: ImpressoApplication): IResolver<NewspaperInternal> => {
  const mediaSources = app.service('media-sources')
  return async (id: string, _) => {
    const lookup = await mediaSources.getLookup()
    const item = lookup[id]
    return optionalMediaSourceToNewspaper(item)
  }
}

export const buildResolvers = (app: ImpressoApplication): ICachedResolvers => ({
  collection: collectionResolver,
  location: entityResolver,
  person: entityResolver,
  topic: topicResolver,
  year: yearResolver,
  newspaper: getNewspaperResolver(app),
})
