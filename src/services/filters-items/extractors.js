import { buildResolvers } from '../../internalServices/cachedResolvers'
const Entity = require('../../models/entities.model')

const isDateRangeString = v => v.match(/.+ TO .+/) != null
const getDateStrings = v => v.match(/(.+) TO (.+)/).slice(1, 3)

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

async function newspaperExtractor({ q = '' }, app) {
  const resolvers = buildResolvers(app)

  const codes = Array.isArray(q) ? q : [q]
  return await Promise.all(codes.map(async code => resolvers.newspaper(code.trim())))
}

async function topicExtractor({ q = '' }, app) {
  const resolvers = buildResolvers(app)
  const items = Array.isArray(q) ? q : [q]
  return (await Promise.all(items.map(async item => await resolvers.topic(item.trim())))).filter(item => item != null)
}

async function entityExtractor({ q = '' }, app) {
  const resolvers = buildResolvers(app)
  const items = Array.isArray(q) ? q : [q]
  return await Promise.all(
    items.map(async item => {
      const uid = item.trim()
      const type = Entity.getTypeFromUid(uid)
      return type === 'person' ? await resolvers.person(uid) : await resolvers.location(uid)
    })
  ).filter(item => item != null)
}

async function yearExtractor({ q = '' }, app) {
  const resolvers = buildResolvers(app)

  const items = Array.isArray(q) ? q : [q]
  return (await Promise.all(items.map(async item => resolvers.year(item.trim())))).filter(item => item != null)
}

async function collectionExtractor({ q = '' }, app) {
  const items = Array.isArray(q) ? q : [q]

  try {
    return await Promise.all(
      items.map(async item => {
        const payload = { query: { nameOnly: true } }
        return app.service('collections').get(item.trim(), payload)
      })
    )
  } catch (error) {
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

module.exports = {
  daterangeExtractor,
  newspaperExtractor,
  topicExtractor,
  entityExtractor,
  yearExtractor,
  collectionExtractor,
  numberRangeExtractor,
  simpleValueExtractor,
}
