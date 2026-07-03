import type { ClientService, Id, Params } from '@feathersjs/feathers'
import { NotFound } from '@feathersjs/errors'
import { PublicFindResponse as FindResponse } from '@/models/common.js'
import { DataProvider } from '@/models/generated/canonical.js'
import type { PartnerInstitutionsDirectory } from '@/internalServices/partnerInstitutionsDirectory.js'

type FindQuery = Pick<FindResponse<unknown>['pagination'], 'limit' | 'offset'> & {
  term?: string
}

export const DefaultPageSize = 20

const normalizeString = (str: string) =>
  str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

const newTermFilter = (term?: string) => (provider: DataProvider) => {
  if (term == null) return true
  const normalizedTerm = normalizeString(term)

  // Search in provider ID
  const normalizedId = normalizeString(provider.id)
  if (normalizedId.includes(normalizedTerm)) return true

  // Search in provider names
  return provider.names.some(nameEntry => {
    const normalizedName = normalizeString(nameEntry.name)
    return normalizedName.includes(normalizedTerm)
  })
}

export class DataProviders
  implements Pick<ClientService<DataProvider, unknown, unknown, FindResponse<DataProvider>>, 'find' | 'get'>
{
  constructor(private readonly getDirectory: () => PartnerInstitutionsDirectory) {}

  private getDataProviders(): DataProvider[] {
    return this.getDirectory().map(entry => ({
      id: entry.partner_institution_id,
      name: entry.partner_institution_names?.[0]?.name ?? '',
      names: entry.partner_institution_names.map(nameEntry => ({
        langCode: nameEntry.lang,
        name: nameEntry.name,
      })),
      bitmapIndex: entry.partner_bitmap_index,
    }))
  }

  async find(params?: Params<FindQuery>): Promise<FindResponse<DataProvider>> {
    const { limit = DefaultPageSize, offset = 0, term } = params?.query ?? {}

    const termFilter = newTermFilter(term)
    const filteredResult = this.getDataProviders().filter(termFilter)

    // Sort by ID for consistency
    const sortedResult = filteredResult.sort((a, b) => a.id.localeCompare(b.id))
    const page = sortedResult.slice(offset, offset + limit)

    return {
      pagination: {
        limit,
        offset,
        total: filteredResult.length,
      },
      data: page,
    }
  }

  async get(id: Id, params?: Params): Promise<DataProvider> {
    const provider = this.getDataProviders().find(p => p.id === id)
    if (provider == null) throw new NotFound(`Data provider with id ${id} not found`)
    return provider
  }
}
