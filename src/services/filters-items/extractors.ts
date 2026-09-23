import { buildResolvers } from '@/internalServices/cachedResolvers.js'
import { ImpressoApplication } from '@/types.js'
import { getTypeFromId } from '@/utils/entity.utils.js'
import { optionalMediaSourceToNewspaper } from '@/services/newspapers/newspapers.class.js'

type QParam = string | string[]
type WithQ = { q?: QParam }
type DateRange = { start: string | undefined; end: string | undefined }
type FloatRange = { start: number; end: number }
type IntRange = { start: number; end: number }
type IdItem = { id: string }
type ImageResolverKey = 'imageVisualContent' | 'imageTechnique' | 'imageCommunicationGoal' | 'imageContentType'

/**
 * Normalizes a query parameter into an array of strings.
 *
 * If the input is already an array, it is returned unchanged; otherwise,
 * the single value is wrapped in a new array.
 *
 * @param q - The query parameter value, either a string or an array of strings.
 * @returns A string array representation of the input.
 */
const toArray = (q: QParam): string[] => (Array.isArray(q) ? q : [q])

const isDateRangeString = (v: string): boolean => v.match(/.+ TO .+/) != null

/**
 * Extracts the start and end date strings from a range expression formatted as `"start TO end"`.
 * @param v - The input string containing the date range.
 * @returns A tuple containing the start and end date strings, or `undefined` if the input format is invalid.
 */
const getDateStrings = (v: string): [string | undefined, string | undefined] =>
  (v.match(/(.+) TO (.+)/)?.slice(1, 3) ?? [undefined, undefined]) as [string | undefined, string | undefined]

/**
 * Generic function to resolve items based on their IDs using the appropriate resolver from the cached resolvers.
 * @param q - The query parameter containing the item IDs, which can be a string or an array of strings.
 * @param app - The Impresso application instance, used to access the cached resolvers.
 * @param resolve - A function that takes the cached resolvers and an individual item ID, and returns a promise that resolves to the corresponding item or `null`/`undefined` if it cannot be resolved.
 * @returns A promise that resolves to an array of resolved items, filtering out any that could not be resolved (i.e., those that are `null` or `undefined`).
 */
const resolveItems = async <T>(
  q: QParam,
  app: ImpressoApplication,
  resolve: (resolvers: ReturnType<typeof buildResolvers>, item: string) => Promise<T | null | undefined>
): Promise<NonNullable<Awaited<T>>[]> => {
  const resolvers = buildResolvers(app)
  const items = toArray(q)
  const mapped = await Promise.all(items.map(item => resolve(resolvers, item.trim())))
  return mapped.filter((item): item is NonNullable<Awaited<T>> => item != null)
}

export const daterangeExtractor = ({ q = '' }: WithQ): DateRange[] => {
  const values = toArray(q)
  const isTwoDatesArray = values.length === 2 && values.filter(isDateRangeString).length === 0
  if (isTwoDatesArray) {
    const [start, end] = values
    return [{ start, end }]
  }
  return values.map(value => {
    const [start, end] = getDateStrings(value)
    return { start, end }
  })
}

export const newspaperExtractor = async ({ q = '' }: WithQ, app: ImpressoApplication) => {
  const resolvers = buildResolvers(app)
  const codes = toArray(q)
  const dataSources = await Promise.all(codes.map(code => resolvers.mediaSource(code.trim())))
  return dataSources.map(optionalMediaSourceToNewspaper)
}

export const mediaSourceExtractor = async ({ q = '' }: WithQ, app: ImpressoApplication) => {
  const resolvers = buildResolvers(app)
  const codes = toArray(q)
  const dataSources = await Promise.all(codes.map(code => resolvers.mediaSource(code.trim())))
  return dataSources.filter((ds): ds is NonNullable<(typeof dataSources)[number]> => ds != null)
}

export const specialMembershipAccessExtractor = async ({ q = '' }: WithQ, app: ImpressoApplication) =>
  resolveItems(q, app, (resolvers, item) => resolvers.specialMembershipAccess(item))

export const topicExtractor = async ({ q = '' }: WithQ, app: ImpressoApplication) =>
  resolveItems(q, app, (resolvers, item) => resolvers.topic(item))

/**
 * Extract generic entity items (person or location) based on their ID, which encodes the type as a prefix. For example, "person-123" or "location-456".
 */
export const entityExtractor = async ({ q = '' }: WithQ, app: ImpressoApplication) =>
  resolveItems(q, app, (resolvers, item) => {
    const type = getTypeFromId(item)
    if (type === 'person') {
      return resolvers.person(item)
    }
    if (type === 'location') {
      return resolvers.location(item)
    }
    if (type === 'nag') {
      return resolvers.nag(item)
    }
    if (type === 'organisation') {
      return resolvers.organisation(item)
    }
    return resolvers.location(item)
  })

export const yearExtractor = async ({ q = '' }: WithQ, app: ImpressoApplication) =>
  resolveItems(q, app, (resolvers, item) => resolvers.year(item))

export const collectionExtractor = async ({ q = '' }: WithQ, app: ImpressoApplication) => {
  const items = toArray(q)
  try {
    const result = await Promise.all(items.map(item => app.service('collections').getInternal(item.trim())))
    return result.filter(v => v != null)
  } catch (error: Error | any) {
    if (error.name === 'NotFound') return []
    throw error
  }
}

export const floatRangeExtractor = ({ q = '' }: WithQ): FloatRange[] => {
  const [start, end] = Array.isArray(q) ? q : (q as string).trim().split(' TO ')
  return start && end ? [{ start: parseFloat(start), end: parseFloat(end) }] : []
}

export const integerRangeExtractor = ({ q = '' }: WithQ): IntRange[] => {
  const [start, end] = Array.isArray(q) ? q : (q as string).trim().split(' TO ')
  return start && end ? [{ start: parseInt(start, 10), end: parseInt(end, 10) }] : []
}

export const simpleValueExtractor = ({ q = '' }: WithQ): IdItem[] => toArray(q).map(item => ({ id: item.trim() }))

export const getImageTypeExtractor =
  (type: ImageResolverKey) =>
  async ({ q = '' }: WithQ, app: ImpressoApplication) =>
    resolveItems(q, app, (resolvers, item) => resolvers[type](item))
