import { EntityDetails } from '../models/generated/schemas'
import {
  EntityDetails as EntityDetailsPublic,
  WikidataPerson,
  WikidataLocation,
} from '../models/generated/schemasPublic'

const transformDateTimeISO = (input?: any): string | undefined => {
  if (input === undefined) {
    return undefined
  }
  const d = new Date(input.replace(/^\+/, ''))
  if (!isNaN(d.getTime())) {
    return d.toISOString()
  }
}

const transformNumber = (input?: any): number | undefined => {
  const value = parseFloat(input)
  if (isNaN(value)) {
    return undefined
  }
  return value
}

const transformWikidataLocation = (input?: EntityDetails['wikidata']): WikidataLocation | undefined => {
  if (input?.type === 'location') {
    return {
      id: input.id,
      type: 'location',
      labels: input.labels,
      descriptions: input.descriptions,
      coordinates: {
        latitude: transformNumber((input.coordinates as any).latitude),
        longitude: transformNumber((input.coordinates as any).longitude),
      },
    } satisfies WikidataLocation
  }
}

const transformWikidataHuman = (input?: EntityDetails['wikidata']): WikidataPerson | undefined => {
  if (input?.type === 'human') {
    return {
      id: input.id,
      type: 'human',
      labels: input.labels,
      descriptions: input.descriptions,
      birthDate: transformDateTimeISO(input.birthDate),
      deathDate: transformDateTimeISO(input.deathDate),
      birthPlace: transformWikidataLocation(input.birthPlace as EntityDetails['wikidata']),
      deathPlace: transformWikidataLocation(input.deathPlace as EntityDetails['wikidata']),
    } satisfies WikidataPerson
  }
}

const transformWikidataDetails = (input?: EntityDetails['wikidata']): WikidataPerson | WikidataLocation | undefined => {
  if (input?.type === 'human') return transformWikidataHuman(input)
  if (input?.type === 'location') return transformWikidataLocation(input)
  return undefined
}

export const transformEntityDetails = (input: EntityDetails): EntityDetailsPublic => {
  return {
    uid: input.uid,
    label: input.name,
    totalContentItems: input.countItems,
    totalMentions: input.countMentions,
    type: input.type,
    wikidataId: input.wikidataId,
    wikidataDetails: transformWikidataDetails(input.wikidata),
  }
}
