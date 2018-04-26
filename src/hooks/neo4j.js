const { neo4jToInt } = require('../services/neo4j.utils');

const normalizeTimeline = () => {
  return async context => {
    context.result = context.result.records.map(record => {
      return {
        t: neo4jToInt(record._fields[0]),
        w: neo4jToInt(record._fields[1]),
      }
    })
  }
}

const normalizeEmptyRecords = () => {
  return async context => {
    // only when empty array are given
    console.log('ooooo', context.result)
    if(Array.isArray(context.result) && !context.result.length) {
      context.result = {
        count: 0,
        records : []
      }
    }
  }
}

module.exports = {
  normalizeTimeline,
  normalizeEmptyRecords
}
