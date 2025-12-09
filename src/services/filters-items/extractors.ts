import { buildResolvers } from '../../internalServices/cachedResolvers'
import { ImpressoApplication } from '../../types'
import { getTypeFromUid } from '../../utils/entity.utils'

const isDateRangeString = (v: string) => v.match(/.+ TO .+/) != null
const getDateStrings = (v: string) => v.match(/(.+) TO (.+)/)?.slice(1, 3) ?? [undefined, undefined]

function daterangeExtractor({ q = '' }) {
  const values = Array.isArray(q) ? q : [q]

  // if `q` is an array with two date strings, return one item for them
  const isTwoDatesArray = values.length === 2 && values.filter(isDateRangeString).length === 0
  if (isTwoDatesArray) {
    const [start, end] = values
    return [{ start, end }]
  }

  // otherwise parse ranges
  return values.map(value => {
    const [start, end] = getDateStrings(value)
    return { start, end }
  })
}

async function newspaperExtractor({ q = '' }, app: ImpressoApplication) {
  const resolvers = buildResolvers(app)

  const codes = Array.isArray(q) ? q : [q]
  return await Promise.all(codes.map(async code => resolvers.newspaper(code.trim())))
}

async function topicExtractor({ q = '' }, app: ImpressoApplication) {
  const resolvers = buildResolvers(app)
  const items = Array.isArray(q) ? q : [q]
  const mappedItems = await Promise.all(items.map(async item => await resolvers.topic(item.trim())))
  return mappedItems.filter(item => item != null)
}

async function entityExtractor({ q = '' }, app: ImpressoApplication) {
  const resolvers = buildResolvers(app)
  const items = Array.isArray(q) ? q : [q]
  const mappedItems = await Promise.all(
    items.map(async item => {
      const uid = item.trim()
      const type = getTypeFromUid(uid)
      return type === 'person' ? await resolvers.person(uid) : await resolvers.location(uid)
    })
  )
  return mappedItems.filter(item => item != null)
}

async function yearExtractor({ q = '' }, app: ImpressoApplication) {
  const resolvers = buildResolvers(app)

  const items = Array.isArray(q) ? q : [q]
  const mappedItems = await Promise.all(items.map(async item => resolvers.year(item.trim())))
  return mappedItems.filter(item => item != null)
}

async function collectionExtractor({ q = '' }, app: ImpressoApplication) {
  const items = Array.isArray(q) ? q : [q]

  try {
    return await Promise.all(
      items.map(async item => {
        return app.service('collections').getInternal(item.trim())
      })
    )
  } catch (error: Error | any) {
    if (error.name === 'NotFound') return []
    throw error
  }
}

function numberRangeExtractor({ q = '' }) {
  const [start, end] = Array.isArray(q) ? q : q.trim().split(' TO ')
  return start && end ? [{ start: parseInt(start, 10), end: parseInt(end, 10) }] : []
}

function simpleValueExtractor({ q = '' }) {
  const items = Array.isArray(q) ? q : [q.trim()]
  return items.map(uid => ({ uid }))
}

const getImageTypeExtractor = (
  type: 'imageVisualContent' | 'imageTechnique' | 'imageCommunicationGoal' | 'imageContentType'
) => {
  const extractor = async ({ q = '' }, app: ImpressoApplication) => {
    const items = Array.isArray(q) ? q : [q.trim()]
    const resolvers = buildResolvers(app)

    const mappedItems = await Promise.all(items.map(async item => resolvers[type](item.trim())))
    return mappedItems.filter(item => item != null)
  }

  return extractor
}

export {
  daterangeExtractor,
  newspaperExtractor,
  topicExtractor,
  entityExtractor,
  yearExtractor,
  collectionExtractor,
  numberRangeExtractor,
  simpleValueExtractor,
  getImageTypeExtractor,
}
