import type { ClientService, Id, Params, ServiceMethods } from '@feathersjs/feathers'
import { Cache, WellKnownKeys } from '../../cache'
import type { MediaSource } from '../../models/generated/schemas'
import { NotFound } from '@feathersjs/errors'
import { PublicFindResponse as FindResponse } from '../../models/common'

type FindQuery = Pick<FindResponse<unknown>['pagination'], 'limit' | 'offset'> & {
  term?: string
  type?: MediaSource['type']
}

export const DefaultPageSize = 20

const normalizeString = (str: string) =>
  str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

const newTermFilter = (term?: string) => (mediaSource: MediaSource) => {
  if (term == null) return true
  const normalizedTerm = normalizeString(term)
  const normalizedMediaSourceName = normalizeString(mediaSource.name)
  return normalizedMediaSourceName.includes(normalizedTerm)
}

const newTypeFilter = (type?: MediaSource['type']) => (mediaSource: MediaSource) => {
  if (type == null) return true
  return mediaSource.type === type
}

export class MediaSources
  implements Pick<ClientService<MediaSource, unknown, unknown, FindResponse<MediaSource>>, 'find' | 'get'>
{
  constructor(private readonly cache: Cache) {}

  async find(params?: Params<FindQuery>): Promise<FindResponse<MediaSource>> {
    return await this.findMediaSources(params)
  }
  async get(id: Id, params?: Params): Promise<MediaSource> {
    const source = await this.getMediaSource(id)
    if (source == null) throw new NotFound(`Media source with id ${id} not found`)
    return source
  }

  async findMediaSources(params?: Params<FindQuery>): Promise<FindResponse<MediaSource>> {
    const { limit = DefaultPageSize, offset = 0 } = params?.query ?? {}

    const result = await this.cache.get<string>(WellKnownKeys.MediaSources)
    const deserialisedResult: MediaSource[] = JSON.parse(result ?? '[]')

    const termFilter = newTermFilter(params?.query?.term)
    const typeFilter = newTypeFilter(params?.query?.type)
    const combinedFilter = (source: MediaSource) => termFilter(source) && typeFilter(source)

    const filteredResult = deserialisedResult.filter(combinedFilter)
    const page = filteredResult?.slice(offset, offset + limit) ?? []

    return {
      pagination: {
        limit,
        offset,
        total: filteredResult?.length ?? 0,
      },
      data: page,
    }
  }

  async getMediaSource(id: Id, params?: Params): Promise<MediaSource | undefined> {
    const result = await this.cache.get<MediaSource[]>(WellKnownKeys.MediaSources)
    const item = result?.find(mediaSource => mediaSource.uid === id)
    return item
  }
}
