import type { ClientService, Id, Params, ServiceMethods } from '@feathersjs/feathers'
import { Cache, WellKnownKeys } from '../../cache'
import type { MediaSource } from '../../models/generated/schemas'
import { NotFound } from '@feathersjs/errors'
import { PublicFindResponse as FindResponse } from '../../models/common'

export type OrderBy =
  | 'name'
  | '-name'
  | 'firstIssue'
  | '-firstIssue'
  | 'lastIssue'
  | '-lastIssue'
  | 'countIssues'
  | '-countIssues'

type FindQuery = Pick<FindResponse<unknown>['pagination'], 'limit' | 'offset'> & {
  term?: string
  type?: MediaSource['type']
  order_by?: OrderBy
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

const sorters: Record<OrderBy, (a: MediaSource, b: MediaSource) => number> = {
  name: (a, b) => a.name.localeCompare(b.name),
  '-name': (a, b) => b.name.localeCompare(a.name),
  firstIssue: (a, b) => new Date(a.datesRange[0]).getTime() - new Date(b.datesRange[0]).getTime(),
  '-firstIssue': (a, b) => new Date(b.datesRange[0]).getTime() - new Date(a.datesRange[0]).getTime(),
  lastIssue: (a, b) => new Date(a.datesRange[1]).getTime() - new Date(b.datesRange[1]).getTime(),
  '-lastIssue': (a, b) => new Date(b.datesRange[1]).getTime() - new Date(a.datesRange[1]).getTime(),
  countIssues: (a, b) => (a.totals.issues ?? 0) - (b.totals.issues ?? 0),
  '-countIssues': (a, b) => (b.totals.issues ?? 0) - (a.totals.issues ?? 0),
}

export const OrderByValues = Object.freeze(Object.keys(sorters))

export class MediaSources
  implements Pick<ClientService<MediaSource, unknown, unknown, FindResponse<MediaSource>>, 'find' | 'get'>
{
  constructor(private readonly cache: Cache) {}

  async find(params?: Params<FindQuery>): Promise<FindResponse<MediaSource>> {
    return await this.findMediaSources(params?.query)
  }
  async get(id: Id, params?: Params): Promise<MediaSource> {
    const source = await this.getMediaSource(id)
    if (source == null) throw new NotFound(`Media source with id ${id} not found`)
    return source
  }

  async findMediaSources(query?: FindQuery): Promise<FindResponse<MediaSource>> {
    const { limit = DefaultPageSize, offset = 0, term, type, order_by } = query ?? {}

    const result = await this.cache.get<string>(WellKnownKeys.MediaSources)
    const deserialisedResult: MediaSource[] = JSON.parse(result ?? '[]')

    const termFilter = newTermFilter(term)
    const typeFilter = newTypeFilter(type)
    const combinedFilter = (source: MediaSource) => termFilter(source) && typeFilter(source)
    const sorter = sorters[order_by ?? 'name']

    const filteredResult = deserialisedResult.filter(combinedFilter).sort(sorter)
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

  async getMediaSource(id: Id): Promise<MediaSource | undefined> {
    const result = await this.cache.get<MediaSource[]>(WellKnownKeys.MediaSources)
    const item = result?.find(mediaSource => mediaSource.uid === id)
    return item
  }
}
