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


module.exports = {
  normalizeTimeline
}