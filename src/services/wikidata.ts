/**
 * Wikibase REST API Swagger and OpenAPI 3.0 definitions:
 * https://doc.wikimedia.org/Wikibase/master/js/rest-api/
 */

import Debug from 'debug'
import lodash from 'lodash'
import type { Entities, Entity, EntityId } from 'wikibase-sdk' with { 'resolution-mode': 'import' }
// import { WBK } from 'wikibase-sdk'
import { RedisClient } from '../redis'
import { createFetchClient } from '../utils/http/client'
import type { IFetchClient } from '../utils/http/client/base'
import { WikidataEntityDetails } from '@/models/generated/schemas'
import { parallelLimit } from '../util/fn'

export type ICache = Pick<RedisClient, 'get' | 'set'>

export type { EntityId }

const importWBK = async () => {
  const { WBK } = await import('wikibase-sdk')

  const wbk = WBK({
    instance: 'https://www.wikidata.org',
    sparqlEndpoint: 'https://query.wikidata.org/sparql',
  })
  return wbk
}

const debug = Debug('impresso/services:wikidata')

const IS_INSTANCE_OF = 'P31'
const IS_HUMAN = 'Q5'
// const IS_FICTIONAL_HUMAN = 'Q15632617';
const PLACE_COUNTRY = 'P17'
const PLACE_COORDINATES = 'P625'
// const PLACE_ADMIN_AREA = 'P131';

type INamedEntityImage = WikidataEntityDetails['images'][0]

/**
 * E.g.: {"en": "House", "fr": "Maison", "de": "Haus"}
 */
type LangLables = { [k: string]: string }

type INamedEntity = WikidataEntityDetails

interface IClaims {
  P18?: any[]
}

interface INamedEntityOptions {
  id: string
  type: string
  labels: LangLables
  descriptions: LangLables
  claims: IClaims
}

class NamedEntity implements INamedEntity {
  id: string
  type: string
  labels: LangLables
  descriptions: LangLables
  _pendings: Record<string, (keyof this)[]>
  images: INamedEntityImage[]

  constructor({ id = '', type = '', labels = {}, descriptions = {}, claims = {} }: Partial<INamedEntityOptions> = {}) {
    this.id = String(id)
    this.type = String(type)
    this.labels = labels
    this.descriptions = descriptions
    this._pendings = {}

    if (Array.isArray(claims.P18)) {
      this.images = claims.P18.map(d => ({
        value: d.mainsnak.datavalue.value,
        rank: d.rank,
        datatype: d.mainsnak.datatype,
      }))
    } else {
      this.images = []
    }
  }

  addPending<K extends keyof this>(property: K, id: string) {
    if (!this._pendings[id]) {
      this._pendings[id] = []
    }
    this._pendings[id].push(property)
  }

  getPendings() {
    return Object.keys(this._pendings)
  }

  resolvePendings(entities: Record<string, Entity>) {
    // console.log('RESOLVE', entities, this.getPendings());
    debug(`resolvePendings for ${this.id}`)
    this.getPendings().forEach(id => {
      if (entities[id]) {
        this._pendings[id].forEach(property => {
          this[property] = entities[id] as this[typeof property]
        })
      }
    })
  }

  toJSON(): INamedEntity {
    return {
      id: this.id,
      type: this.type,
      labels: this.labels,
      descriptions: this.descriptions,
      images: this.images,
    }
  }
}

export interface ILocation extends INamedEntity {
  coordinates: any
  country: any
  adminArea: any
}

class Location extends NamedEntity {
  coordinates: any
  country: any

  constructor({ id = '', claims = {}, labels = {}, descriptions = {} } = {}) {
    super({
      id,
      claims,
      labels,
      descriptions,
      type: 'location',
    })

    //
    // this.coordinates = {
    //  "latitude": 45.566666666667,
    //  "longitude": 8.9333333333333,
    //  "altitude": null,
    //  "precision": 0.00027777777777778,
    // }
    this.coordinates = lodash.get(claims, `${PLACE_COORDINATES}[0].mainsnak.datavalue.value`)

    this.country = lodash.get(claims, `${PLACE_COUNTRY}[0].mainsnak.datavalue.value`)

    if (this.country && this.country.id) {
      this.addPending('country', this.country.id)
    }
  }

  toJSON(): ILocation {
    return {
      ...super.toJSON(),
      coordinates: this.coordinates,
      country: this.country,
      adminArea: (this as unknown as any).adminArea,
    }
  }
}

export interface IHuman extends INamedEntity {
  birthDate: any
  deathDate: any
  birthPlace: any
  deathPlace: any
}

/**
 *
 * [parseHuman description]
 * @param  {[type]} const [description]
 * @return {[type]}       [description]
 */
class Human extends NamedEntity {
  birthDate: any
  deathDate: any
  birthPlace: any
  deathPlace: any

  constructor({ id = '', claims = {}, labels = {}, descriptions = {} } = {}) {
    super({
      id,
      claims,
      labels,
      descriptions,
      type: 'human',
    })

    this.birthDate = lodash.get(claims, 'P569[0].mainsnak.datavalue.value.time')

    this.deathDate = lodash.get(claims, 'P570[0].mainsnak.datavalue.value.time')

    // get related entities: birthPlace, deathPlace,
    this.birthPlace = lodash.get(claims, 'P19[0].mainsnak.datavalue.value')

    this.deathPlace = lodash.get(claims, 'P20[0].mainsnak.datavalue.value')

    if (this.birthPlace && this.birthPlace.id) {
      this.addPending('birthPlace', this.birthPlace.id)
    }

    if (this.deathPlace && this.deathPlace.id) {
      this.addPending('deathPlace', this.deathPlace.id)
    }
  }

  toJSON(): IHuman {
    return {
      ...super.toJSON(),
      birthDate: this.birthDate,
      deathDate: this.deathDate,
      birthPlace: this.birthPlace,
      deathPlace: this.deathPlace,
    }
  }
}

const getNamedEntityClass = (entity: { claims: any }) => {
  const iof = lodash.get(entity.claims, `${IS_INSTANCE_OF}[0]mainsnak.datavalue.value.id`)
  debug('getNamedEntityClass: iof', iof)
  if (iof === IS_HUMAN) {
    return Human
  }

  if (entity.claims[PLACE_COORDINATES]) {
    return Location
  }
  return NamedEntity
}

/**
 * Return a new Entity intance with the correct subclass
 * @param  {NamedEntity} entity [description]
 * @return {any}        [description]
 */
const createEntity = (entity: any, wbk: any) => {
  // parse with wikidata sdk
  const simplified = wbk.simplify.entity(entity)
  const Klass = getNamedEntityClass(entity)
  // should be done with Proxy objects indeed
  return new Klass({
    id: simplified.id,
    type: simplified.type,
    descriptions: simplified.descriptions ?? {},
    labels: simplified.labels ?? {},
    claims: entity.claims,
  })
}

interface ResolveOptions {
  ids?: EntityId[]
  languages?: string[]
  depth?: number
  maxDepth?: number
  cache?: ICache
}

export const WikidataCacheKeyPrefix = 'cache:wikidata:'

/**
 * Resolves entities from cache or API, with per-ID caching.
 * Looks up each entity ID in cache first. IDs not in cache are fetched from the API.
 * All results (cached + fetched) are stored in cache by individual ID and returned.
 * @param entityIds Array of entity IDs to resolve
 * @param languages Languages to fetch labels and descriptions in
 * @param cache Optional cache instance for storing individual entities
 * @param fetchClient Optional fetch client (defaults to createFetchClient)
 * @returns Promise resolving to all requested entities
 */
export const resolveWithCache = async (
  entityIds: EntityId[],
  languages: string[] = ['en', 'fr', 'de', 'it'],
  cache?: ICache,
  fetchClient?: IFetchClient
): Promise<Entities> => {
  const wbk = await importWBK()
  const result: Entities = {}
  const idsToFetch: EntityId[] = []

  // Check cache for each ID in parallel
  const cacheCheckResults = await parallelLimit(
    entityIds,
    async id => {
      const cacheKey = `${WikidataCacheKeyPrefix}${id}`
      if (cache) {
        const cached = await cache.get(cacheKey)
        if (cached) {
          debug(`resolveWithCache: cache hit for ${id}`)
          return { id, cached: JSON.parse(cached), found: true }
        }
      }
      return { id, cached: null, found: false }
    },
    5 // concurrency limit of 5
  )

  // Process cache check results
  for (const { id, cached, found } of cacheCheckResults) {
    if (found) {
      result[id] = cached
    } else {
      idsToFetch.push(id)
    }
  }

  // Fetch missing IDs from API
  if (idsToFetch.length > 0) {
    debug(`resolveWithCache: fetching ${idsToFetch.length} entities from API`)
    const url = wbk.getEntities({ ids: idsToFetch, languages })

    const client = fetchClient || createFetchClient({})
    const response = await client.fetch(url, {
      headers: {
        'User-Agent': 'Impresso/1.0 (https://impresso-project.ch/app)',
      },
    })

    const data = await response.json()

    // Store fetched entities in cache and result
    for (const id of idsToFetch) {
      if (data.entities[id]) {
        const entityData = data.entities[id]
        result[id] = entityData

        if (cache) {
          const cacheKey = `${WikidataCacheKeyPrefix}${id}`
          await cache.set(cacheKey, JSON.stringify(entityData))
          debug(`resolveWithCache: stored ${id} in cache`)
        }
      }
    }
  }

  return result
}

type AnyNamedEntity = NamedEntity | Location | Human

export const resolve = async ({
  ids = [],
  languages = ['en', 'fr', 'de', 'it'], // platform languages
  cache,
}: ResolveOptions = {}): Promise<Record<string, AnyNamedEntity>> => {
  const entities: Record<string, AnyNamedEntity> = {}

  const fetchClient = createFetchClient({})

  const firstLevelEntities = await resolveWithCache(ids ?? [], languages, cache, fetchClient)

  const wbk = await importWBK()
  Object.entries(firstLevelEntities).forEach(([id, entity]) => {
    entities[id] = createEntity(entity, wbk)
  })
  const secondLevelIds = Object.values(entities)
    .map(e => e.getPendings())
    .reduce((acc, val) => acc.concat(val), []) as EntityId[]

  const secondLevelEntities = await resolveWithCache(lodash.uniq(secondLevelIds), languages, cache, fetchClient)
  Object.values(entities).forEach(e => {
    e.resolvePendings(secondLevelEntities)
  })

  return entities
}
