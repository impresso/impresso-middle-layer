import type { ClientService, Id, Params, ServiceMethods } from '@feathersjs/feathers'
import { Cache, WellKnownKeys } from '@/cache.js'
import type { MediaSource } from '@/models/generated/schemas.js'
import { NotFound } from '@feathersjs/errors'
import { PublicFindResponse as FindResponse } from '@/models/common.js'

type PartialMediaSource = Omit<MediaSource, 'properties'> & { properties?: MediaSource['properties'] }

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
  include_properties?: boolean
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

const propsMapper =
  (includeProperties: boolean) =>
  (mediaSource: MediaSource): PartialMediaSource => {
    if (includeProperties) return mediaSource
    const { properties, ...rest } = mediaSource
    return rest
  }

const sorters: Record<OrderBy, (a: MediaSource, b: MediaSource) => number> = {
  name: (a, b) => a.name.localeCompare(b.name),
  '-name': (a, b) => b.name.localeCompare(a.name),
  firstIssue: (a, b) =>
    new Date(a.availableDatesRange?.[0] ?? 0).getTime() - new Date(b.availableDatesRange?.[0] ?? 0).getTime(),
  '-firstIssue': (a, b) =>
    new Date(b.availableDatesRange?.[0] ?? 0).getTime() - new Date(a.availableDatesRange?.[0] ?? 0).getTime(),
  lastIssue: (a, b) =>
    new Date(a.availableDatesRange?.[1] ?? 0).getTime() - new Date(b.availableDatesRange?.[1] ?? 0).getTime(),
  '-lastIssue': (a, b) =>
    new Date(b.availableDatesRange?.[1] ?? 0).getTime() - new Date(a.availableDatesRange?.[1] ?? 0).getTime(),
  countIssues: (a, b) => (a.totals.issues ?? 0) - (b.totals.issues ?? 0),
  '-countIssues': (a, b) => (b.totals.issues ?? 0) - (a.totals.issues ?? 0),
}

export const OrderByValues = Object.freeze(Object.keys(sorters))

export class MediaSources
  implements Pick<ClientService<MediaSource, unknown, unknown, FindResponse<PartialMediaSource>>, 'find' | 'get'>
{
  constructor(private readonly cache: Cache) {}

  async find(params?: Params<FindQuery>): Promise<FindResponse<PartialMediaSource>> {
    const result = await this.findMediaSources(params?.query)
    return {
      ...result,
      data: result.data.map(propsMapper(params?.query?.include_properties ?? false)),
    }
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
    const result = await this.cache.get<string>(WellKnownKeys.MediaSources)
    const deserialisedResult: MediaSource[] = JSON.parse(result ?? '[]')

    const item = deserialisedResult?.find(mediaSource => mediaSource.uid === id)
    return item
  }

  async getLookup(): Promise<Record<string, MediaSource>> {
    const results = await this.findMediaSources({
      type: 'newspaper',
      limit: Number.MAX_SAFE_INTEGER,
      offset: 0,
    })

    return results.data.reduce(
      (acc, mediaSource) => {
        acc[mediaSource.uid] = mediaSource
        return acc
      },
      {} as Record<string, MediaSource>
    )
  }
}
