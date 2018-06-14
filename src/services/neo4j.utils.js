const mustache = require('mustache');
const moment   = require('moment');
const debug = require('debug')('impresso/services:neo4j.utils');
const verbose = require('debug')('verbose:impresso/services:neo4j.utils');
const {Conflict, BadRequest, BadGateway, Unavailable} = require('@feathersjs/errors');

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


const neo4jRun = (session, cypherQuery, params) => {
  const preparedQuery = neo4jPrepare(cypherQuery, params);

  debug('neo4jRun: with cypher query:', preparedQuery);

  const queryParams = {
    ... neo4jNow(),
    ... params
  }

  debug('neo4jRun: with cypher params:', queryParams);

  return session.run(preparedQuery, queryParams).then(res => {
    session.close();
    debug('neo4jRun: success! n. records:', res.records.length);
    res.queryParams = queryParams
    return res
  }).catch( err => {
    if(err.code == 'Neo.ClientError.Schema.ConstraintValidationFailed'){
      debug(`neo4jRun failed. Neo.ClientError.Statement.ParameterMissing: ${err}`);
      throw new Conflict('ConstraintValidationFailed')
    } else if(err.code == 'Neo.ClientError.Statement.ParameterMissing'){
      debug('neo4jRun failed. Neo.ClientError.Statement.ParameterMissing:',err)
      throw new BadRequest('ParameterMissing')
    } else if(err.code == 'Neo.ClientError.Statement.SyntaxError'){
      debug('neo4jRun failed. Neo.ClientError.Statement.SyntaxError:',err);
      throw new BadGateway('SyntaxError')
    } else if(err.code == 'ServiceUnavailable') {
      debug('neo4jRun failed. ServiceUnavailable:',err);
      throw new Unavailable()
    } else {
      debug('neo4jRun failed. Check error below.');
      debug(err.code, err);
    }
    throw new BadRequest()
  });
}

// @param res: a transaction result
const neo4jSummary = (res, verbose=false) => {
  if(verbose) {
    return {
      statement: res.summary.statement.text,
      params: res.summary.statement.parameters,
      resultAvailableAfter: res.summary.resultAvailableAfter.low,
      _stats: res.summary.counters._stats,
    }
  }
  return {
    resultAvailableAfter: res.summary.resultAvailableAfter.low,
  }
}

const neo4jNodeMapper = (node) => {
  let props = {}

  for (let k in node.properties){
    if(Array.isArray(node.properties[k])){
      // remap, since we don't know.
      props[k] = node.properties[k].map(d => {
        if(d.constructor.name == 'String')
          return d;
        return neo4jRecordMapper(d);
      })
    }
    if(node.properties[k] && node.properties[k].constructor){
      switch(node.properties[k].constructor.name) {
        case 'Integer':
          props[k] = neo4jToInt(node.properties[k])
          break;
        case 'Node':
          props[k] = neo4jNodeMapper(node.properties[k])
          break;
        default:
          props[k] = node.properties[k]
          // none
          continue
      }
    }
  }
  return {
    // label: node.labels.slice(-1).pop(),
    labels: node.labels,
    ... props
  };
}

const neo4jPathMapper = (path) => {
  debug('neo4jPathMapper: n. of segments:', path.segments.length)
  return {
    type: 'path',
    length: path.length,
    segments: path.segments.map(neo4jPathSegmentMapper)
  }
}

const neo4jPathSegmentMapper = (segment) => {
  return {
    start: neo4jNodeMapper(segment.start),
    end: neo4jNodeMapper(segment.end),
    relationship: {
      type: segment.relationship.type,
      ... segment.relationship.properties
    }
  }
}

const neo4jFieldMapper = (field) => {
  if(typeof field == 'undefined' || field === null)
    return null;
  if(field.constructor.name == 'String')
    return field;
  if(field.constructor.name == 'Integer')
    return neo4jToInt(field);
  if(field.constructor.name == 'Object'){
    for(var key in field) {
      if(field.hasOwnProperty(key)) {
        field[key] = neo4jFieldMapper(field[key]);
      }
    }
    return field
  }
  if(field.constructor.name == 'Node')
    return neo4jNodeMapper(field);
  if(field.constructor.name == 'Path')
    return neo4jPathMapper(field);
  if(field.constructor.name == 'Array')
    return field.map(neo4jFieldMapper)
  if(field.constructor.name == 'Number')
    return field

  debug('neo4jFieldMapper: unknown neo4j constructor:', field.constructor.name);
  // return _field;
}

const neo4jRecordMapper = (record) => {
  // OUR cypher output can be a complex json object.
  // console.log(record)
  if(!record._fieldLookup){
    debug('neo4jRecordMapper: NO _fieldLookup present, record:', record)
  } else {
    verbose('neo4jRecordMapper: _fieldLookup:', record._fieldLookup)
  }

  let results = {},
      keys = [];

  // IF it is a canonical neo4J node
  if(Array.isArray(record._fields)){
    keys = record.keys;

    for(let key in record._fieldLookup) {
      // get array index for record._field array
      let idx = record._fieldLookup[key];
      let _field = record._fields[idx];
      results[key] = neo4jFieldMapper(_field);
    }
  }

  verbose('neo4jRecordMapper: results expected <Keys>:', keys);
  //

  if(keys.length == 1) {
    return results[keys[0]];
  }

  // special fields starting with '_' are NOT idenitites
  const identities = keys.filter(d => d.indexOf('_') !== 0 );


  if(identities.length != 1){
    verbose('neo4jRecordMapper: more than one items in list <identities>:', identities);
    // nothing to do, the query is like this.
    return results;
  }

  verbose('neo4jRecordMapper: merging fields in remaining <identities> item:', identities);

  // apply related as _links
  const extras = keys.filter(d => d.indexOf('_') === 0);
  let result = results[identities[0]];
  for(key of extras){
    result[key.replace('_related_', '')] = results[key];
  }
  return result
}

const neo4jRecords = (res) => {
  let _records = {}
  debug(`find '${this.name}': neo4j success`, neo4jSummary(res));
  for(let rec of res.records) {
    rec = neo4jRecordMapper(rec);
    _records[rec.uid] = rec;
  }
  return _records;
}

const neo4jToInt = neo4jInteger => {
  return typeof neo4jInteger == 'object'? neo4jInteger.low : neo4jInteger
}

module.exports = {
  neo4jNow,
  neo4jPrepare,
  neo4jRecordMapper,
  neo4jRun,
  neo4jSummary,
  neo4jToInt,
}
