import { BadRequest } from '@feathersjs/errors'
import { getLogger } from '@/logger.js'
const logger = getLogger(['impresso', 'hooks', 'neo4j'])
import { neo4jToInt } from '../services/neo4j.utils'

const normalizeTimeline = () => async context => {
  context.result = context.result.records.map(record => ({
    t: neo4jToInt(record._fields[0]),
    w: neo4jToInt(record._fields[1]),
  }))
}

const parseJsonProperty = name => async () => {
  // context.result = context.result.records.map(record => {
  //   return {
  //     t: neo4jToInt(record._fields[0]),
  //     w: neo4jToInt(record._fields[1]),
  //   }
  // })
  logger.debug(`parseJsonProperty: <${name}> parsed correctly.`)
}

const raiseErrorIfEmpty =
  (explanation = {}) =>
    async context => {
      if (Array.isArray(context.result) && !context.result.length) {
        logger.debug(`raiseErrorIfEmpty: apparently context.result is empty! ${context.result}`)
        throw new BadRequest('empty context.result', explanation)
      } else {
        logger.debug('raiseErrorIfEmpty: context.result ok, proceed.')
      }
    }

const normalizeEmptyRecords = () => async context => {
  // only when empty array are given
  if (Array.isArray(context.result) && !context.result.length) {
    logger.debug(`normalizeEmptyRecords: apparently context.result is empty! ${context.result}`)
    context.result = {
      count: 0,
      records: [],
    }
  } else {
    logger.debug('normalizeEmptyRecords: context.result ok, proceed.')
  }
}

export default {
  normalizeTimeline,
  normalizeEmptyRecords,
  raiseErrorIfEmpty,
  parseJsonProperty,
}
