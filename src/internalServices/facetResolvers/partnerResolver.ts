import { IResolver } from '@/internalServices/cachedResolvers.js'
import { ImpressoApplication } from '@/types.js'
import { MediaSource, Partner } from '@/models/generated/schemas.js'

const getPropValue = (source: MediaSource, prop: string) => source.properties?.find(p => p.id === prop)?.value

// In-memory cache
let partnersCache: Record<string, Partner> | null = null

export const getPartnerResolver = (app: ImpressoApplication): IResolver<Partner> => {
  const mediaSources = app.service('media-sources')

  const loadPartnersData = async (): Promise<Record<string, Partner>> => {
    const sources = await mediaSources.getLookup()

    const partners = Object.values(sources).reduce(
      (acc, source) => {
        const partnerUid = getPropValue(source, 'partnerUid')

        if (partnerUid == null) return acc

        if (acc[partnerUid] == null) {
          const partnerNames = getPropValue(source, 'institutionNames')?.split(', ')
          const partnerLinks = getPropValue(source, 'institutionLinks')?.split(', ')

          acc[partnerUid] = {
            id: partnerUid,
            title: partnerNames?.[0] ?? partnerUid,
            url: partnerLinks?.[0],
          }
        }
        return acc
      },
      {} as Record<string, Partner>
    )

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
