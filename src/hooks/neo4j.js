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

// clean context params according to neo4j
const sanitize = ( options ) => {
  return async context => {
    // exit if useless?

    // write params to current result
    let params = {
      limit: 10,
      skip: 0,
      max_limit: 500,
      ... options
    };

    // :: order by
    if(context.params.query.order) {
      // split commas, then filter useless stuffs.
      let orders = context.params.query.order.split(/\s*,\s*/)
      params.orders = orders; 
      console.log(params)
    
    }

    // num of results expected, 0 to 500
    if(context.params.query.limit) {
      let limit = parseInt(context.params.query.limit);
      params.limit = +Math.min(Math.max(0, limit), params.max_limit || 500)
    }
    // transform page in corresponding SKIP. Page is 1-n.
    if(context.params.query.page) {
      let page = Math.max(1, parseInt(context.params.query.page));
      // transform in skip and offsets. E.G page=4 when limit = 10 results in skip=30 page=2 in skip=10, page=1 in skip=0
      params.skip = (page-1) * params.limit;
      params.page = page;
    } else if(context.params.query.offset) {
      params.skip = Math.max(0, parseInt(context.params.query.offset));
    }

    // add sanitized dict to context params.
    context.params.sanitized = params;
    console.log(context.params.sanitized)
  }
}



module.exports = {
  sanitize,
  normalize,
  normalizeTimeline,
  finalize,
  finalizeMany
}