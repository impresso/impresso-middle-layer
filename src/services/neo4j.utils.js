const mustache = require('mustache');
const moment   = require('moment');


const neo4jNow = () => {
  const now = moment.utc();

  return {
    _exec_date: now.format(),
    _exec_time: +now.format('X')
  };
};



const neo4jPrepare = (cypherQuery, params) => {
  // use Mustache renderer to pre-prepare cypehr query.
  // This allows to use if, unless and each templates without
  // adding unwanted complexification in code.
  return mustache.render(cypherQuery, params);
}


const neo4jRecordMapper = (record) => {
  // OUR cypher output can be a complex json object.
  // console.log(record)
  let props  = Array.isArray(record._fields)? record._fields[0].properties? record._fields[0].properties: record._fields[0] : record.properties? record.properties: record;
  let labels = Array.isArray(record._fields) && record._fields[0].labels? record._fields[0].labels: null;

  for (let k in props){
    if(Array.isArray(props[k])){
      props[k] = props[k].map(neo4jRecordMapper)
    }
    if(props[k] && props[k].constructor){
      switch(props[k].constructor.name) {
        case 'Integer':
          props[k] = neo4jToInt(props[k])
          break;
        case 'Node':
          props[k] = neo4jRecordMapper(props[k])
          break;
        default:
          // none
          continue
      }
    }
  }
  // remap _field[0] properties!
  if(labels)
    return {
      labels: labels,
      ... props
    };

  return props
}

const neo4jToInt = neo4jInteger => {
  return typeof neo4jInteger == 'object'? neo4jInteger.low : neo4jInteger
}


module.exports = {
  neo4jNow,
  neo4jPrepare,
  neo4jRecordMapper,
  neo4jToInt,
}
