/*
  Most of this should be done in a correct db adapter. @todo
  https://github.com/feathersjs/docs/blob/master/api/databases/common.md

*/


const neo4jToInt = neo4jInteger => {
  return typeof neo4jInteger == 'object'? neo4jInteger.low : neo4jInteger
}

// will normalize neo4j results (after hooks)
// _field[0] is the obiect to be normalized.
const normalize = ( mapper ) => {
  if(!mapper){
    mapper = record => {
      // OUR cypher output can be a complex json object.
      // console.log(record)
      let props =  Array.isArray(record._fields)? record._fields[0].properties? record._fields[0].properties: record._fields[0] : record.properties? record.properties: record;
      // console.log(props)
      for (let k in props){
        
        if(Array.isArray(props[k])){
          console.log(props[k])
          props[k] = props[k].map(mapper)
        }
        if(props[k] && props[k].constructor && props[k].constructor.name == 'Integer')
          props[k] = neo4jToInt(props[k])
      }
      // remap _field[0] properties!

      return props

      //{
      //  ...props
        // df: neo4jToInt(props.df)
      //}
    }
  }
  return async context => {
    // console.log(context.result)
    context.result.normalized =  context.result.records.map(mapper)
  }
}


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

// will finalize neo4j results, adding pagination. THis should be done in adapters. (after hooks)
const finalize = () => {
  return async context => {
    context.result = context.result.normalized
  }
}

// will get rid of everything. Add count.
const finalizeMany = () => {
  return async context => {
    let records = context.result.normalized,
        count   = context.result.records.length && context.result.records[0]._fields[1]? neo4jToInt(context.result.records[0]._fields[1]): 0;

    context.result = {
      params: context.params.sanitized,
      count,
      records
    }
  }
}


module.exports = {
  normalize,
  normalizeTimeline,
  finalize,
  finalizeMany
}