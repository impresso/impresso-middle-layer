import { ClientService, Id, Params } from '@feathersjs/feathers'
import { Newspaper as NewspaperInternal, MediaSource, NewspaperIssue } from '../../models/generated/schemas'
import { FindResponse } from '../../models/common'
import { DefaultPageSize, MediaSources, OrderBy } from '../media-sources/media-sources.class'
import { NotFound } from '@feathersjs/errors'
import { ImpressoApplication } from '../../types'

const getYear = (isoDateString: string) => new Date(isoDateString).getFullYear()

const mediaSourceToNewspaper = (mediaSource: MediaSource): NewspaperInternal => {
  const startYear = mediaSource.publishedPeriodYears?.[0]
  const endYear = mediaSource.publishedPeriodYears?.[1]
  const deltaYear = (endYear ?? 0) - (startYear ?? 0)

  return {
    uid: mediaSource.uid,
    name: mediaSource.name,
    acronym: mediaSource.uid,
    countArticles: mediaSource.totals.articles ?? 0,
    countIssues: mediaSource.totals.issues ?? 0,
    countPages: mediaSource.totals.pages ?? 0,
    deltaYear,
    startYear: startYear ?? null,
    endYear: endYear ?? null,
    firstIssue:
      mediaSource.availableDatesRange?.[0] != null
        ? ({
            uid: '',
            date: mediaSource.availableDatesRange[0],
            year: getYear(mediaSource.availableDatesRange[0]),
          } as any as NewspaperIssue)
        : undefined,
    lastIssue:
      mediaSource.availableDatesRange?.[1] != null
        ? ({
            uid: '',
            date: mediaSource.availableDatesRange[1],
            year: getYear(mediaSource.availableDatesRange[1]),
          } as any as NewspaperIssue)
        : undefined,
    included: true,
    labels: [],
    languages: mediaSource.languageCodes,
    properties: mediaSource.properties.map(p => ({ label: p.label ?? '', value: p.value, name: p.id })),
  } satisfies NewspaperInternal
}

interface FindQuery {
  q?: string
  order_by?: OrderBy
  limit?: number
  offset?: number
}

const orderByTranslations: Record<string, OrderBy> = {
  startYear: 'firstIssue',
  endYear: 'lastIssue',
  '-startYear': '-firstIssue',
  '-endYear': '-lastIssue',
}

export class NewspapersService
  implements Pick<ClientService<NewspaperInternal, unknown, unknown, FindResponse<NewspaperInternal>>, 'find' | 'get'>
{
  constructor(private readonly app: ImpressoApplication) {}

  private get mediaSources(): MediaSources {
    return this.app.service('media-sources')
  }

  async get(id: Id, params?: Params): Promise<NewspaperInternal> {
    const mediaSource = await this.mediaSources.getMediaSource(id)
    if (mediaSource == null) {
      throw new NotFound(`Media source with id ${id} not found`)
    }
    return mediaSourceToNewspaper(mediaSource)
  }

  async find(params?: Params<FindQuery>): Promise<FindResponse<NewspaperInternal>> {
    const { limit, offset, q, order_by } = params?.query ?? {}

    const results = await this.mediaSources.findMediaSources({
      type: 'newspaper',
      limit: limit ?? DefaultPageSize,
      offset: offset ?? 0,
      term: q,
      order_by: order_by != null ? orderByTranslations[order_by] ?? order_by : undefined,
    })

    return {
      data: results.data.map(mediaSourceToNewspaper),
      limit: results.pagination.limit,
      offset: results.pagination.offset,
      total: results.pagination.total,
      info: {},
    } satisfies FindResponse<NewspaperInternal>
  }

  async getLookup(): Promise<Record<string, NewspaperInternal>> {
    const results = await this.mediaSources.findMediaSources({
      type: 'newspaper',
      limit: Number.MAX_SAFE_INTEGER,
      offset: 0,
    })

    return results.data.reduce(
      (acc, mediaSource) => {
        acc[mediaSource.uid] = mediaSourceToNewspaper(mediaSource)
        return acc
      },
      {} as Record<string, NewspaperInternal>
    )
  }
}
