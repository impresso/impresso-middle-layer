const neo4jToInt = neo4jInteger => {
  return typeof neo4jInteger == 'object'? neo4jInteger.low : neo4jInteger
}

const neo4jRecordMapper = (record) => {
  // OUR cypher output can be a complex json object.
  // console.log(record)
  let props  = Array.isArray(record._fields)? record._fields[0].properties? record._fields[0].properties: record._fields[0] : record.properties? record.properties: record;
  let labels = Array.isArray(record._fields) && record._fields[0].labels? record._fields[0].labels: null;

  // console.log(props)
  for (let k in props){
    if(Array.isArray(props[k])){
      props[k] = props[k].map(neo4jRecordMapper)
    }
    if(props[k] && props[k].constructor && props[k].constructor.name == 'Integer')
      props[k] = neo4jToInt(props[k])
  }
  // remap _field[0] properties!
  if(labels)
    return {
      labels: labels,
      ... props
    };

  return props
}

module.exports = {
  neo4jToInt,
  neo4jRecordMapper
}