import { IResolver } from '@/internalServices/cachedResolvers.js'
import { ImpressoApplication } from '@/types.js'
import { Partner } from '@/models/generated/canonical.js'
import { getPartnerInstitutionsDirectory } from '@/internalServices/partnerInstitutionsDirectory.js'
import type { PartnerInstitutionDirectoryEntry } from '@/internalServices/partnerInstitutionsDirectory.js'

// In-memory cache
let partnersCache: Record<string, Partner> | null = null

const getPreferredPartnerTitle = (entry: PartnerInstitutionDirectoryEntry): string => {
  const names = entry.partner_institution_names ?? []
  const english = names.find(n => n.lang === 'en')?.name
  const first = names[0]?.name
  return english ?? first ?? entry.partner_institution_id
}

const buildPartnersById = (entries: PartnerInstitutionDirectoryEntry[]): Record<string, Partner> => {
  return entries.reduce(
    (acc, entry) => {
      if (acc[entry.partner_institution_id] != null) return acc
      acc[entry.partner_institution_id] = {
        id: entry.partner_institution_id,
        title: getPreferredPartnerTitle(entry),
      }
      return acc
    },
    {} as Record<string, Partner>
  )
}

export const getPartnerResolver = (app: ImpressoApplication): IResolver<Partner> => {
  const loadPartnersData = async (): Promise<Record<string, Partner>> => {
    const partners = buildPartnersById(getPartnerInstitutionsDirectory(app))

    // Store in memory cache
    partnersCache = partners
    return partners
  }

  const getPartnersData = async (): Promise<Record<string, Partner>> => {
    if (partnersCache) {
      return partnersCache
    }
    return loadPartnersData()
  }

  return async (id: string) => {
    const partners = await getPartnersData()
    return partners[id]
  }
}
