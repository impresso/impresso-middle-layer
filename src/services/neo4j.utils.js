/* eslint no-use-before-define: off */
const mustache = require('mustache');
const moment = require('moment');
const debug = require('debug')('impresso/services:neo4j.utils');
const verbose = require('debug')('verbose:impresso/services:neo4j.utils');
const {
  Conflict, BadRequest, BadGateway, Unavailable,
} = require('@feathersjs/errors');


const neo4jToInt = neo4jInteger => (typeof neo4jInteger === 'object' ? neo4jInteger.low : neo4jInteger);

const neo4jNow = () => {
  const now = moment.utc();

  return {
    _exec_date: now.format(),
    _exec_time: +now.format('X'),
  };
};


const neo4jPrepare = (cypherQuery, params) =>
  // use Mustache renderer to pre-prepare cypehr query.
  // This allows to use if, unless and each templates without
  // adding unwanted complexification in code.
  mustache.render(cypherQuery, params);


const neo4jRun = (session, cypherQuery, params, queryname) => {
  const preparedQuery = neo4jPrepare(cypherQuery, params);

  debug('neo4jRun: with cypher query:', queryname || preparedQuery);

  const queryParams = {
    ...neo4jNow(),
    ...params,
  };

  debug('neo4jRun: with cypher params:', queryParams);

  return session.run(preparedQuery, queryParams).then((res) => {
    session.close();
    debug('neo4jRun: success! n. records:', res.records.length);
    res.queryParams = queryParams;
    return res;
  }).catch((err) => {
    if (err.code === 'Neo.ClientError.Schema.ConstraintValidationFailed') {
      debug(`neo4jRun failed. ConstraintValidationFailed: ${err}`);
      throw new Conflict('ConstraintValidationFailed');
    } else if (err.code === 'Neo.ClientError.Statement.ParameterMissing') {
      debug('neo4jRun failed. ParameterMissing:', err);
      throw new BadRequest('ParameterMissing');
    } else if (err.code === 'Neo.ClientError.Statement.SyntaxError') {
      debug('neo4jRun failed. SyntaxError:', err);
      throw new BadGateway('SyntaxError');
    } else if (err.code === 'ServiceUnavailable') {
      debug('neo4jRun failed. ServiceUnavailable:', err);
      throw new Unavailable();
    } else if (err.code === 'Neo.ClientError.Procedure.ProcedureCallFailed') {
      debug('neo4jRun failed. ProcedureCallFailed:', err);
      throw new BadRequest('ProcedureCallFailed');
    } else {
      debug('neo4jRun failed. Check error below.');
      debug(err.code, err);
    }
    throw new BadRequest();
  });
};

// @param res: a transaction result
const neo4jSummary = (res, asVerbose = false) => {
  if (asVerbose) {
    return {
      statement: res.summary.statement.text,
      params: res.summary.statement.parameters,
      resultAvailableAfter: res.summary.resultAvailableAfter.low,
      _stats: res.summary.counters._stats,
    };
  }
  return {
    resultAvailableAfter: res.summary.resultAvailableAfter.low,
  };
};


const neo4jFieldMapper = (field) => {
  if (typeof field === 'undefined' || field === null) { return null; }
  if (field.constructor.name === 'String') { return field; }
  if (field.constructor.name === 'Integer') { return neo4jToInt(field); }
  if (field.constructor.name === 'Object') {
    const _field = {};
    Object.keys(field).forEach((key) => {
      _field[key] = neo4jFieldMapper(field[key]);
    });
    // for (const key of Object.keys(field)) {
    //   if (field.hasOwnProperty(key)) {
    //     field[key] = neo4jFieldMapper(field[key]);
    //   }
    // }
    return _field;
  }
  if (field.constructor.name === 'Node') { return neo4jNodeMapper(field); }
  if (field.constructor.name === 'Path') { return neo4jPathMapper(field); }
  if (field.constructor.name === 'Array') { return field.map(neo4jFieldMapper); }
  if (field.constructor.name === 'Number') { return field; }
  if (field.constructor.name === 'Relationship') { return neo4jRelationshipMapper(field); }
  debug('neo4jFieldMapper: unknown neo4j constructor:', field.constructor.name);
  return null;
};

const neo4jRecordMapper = (record) => {
  // OUR cypher output can be a complex json object.
  // console.log(record)
  if (!record._fieldLookup) {
    debug('neo4jRecordMapper: NO _fieldLookup present, record:', record);
  } else {
    verbose('neo4jRecordMapper: _fieldLookup:', record._fieldLookup);
  }

  const results = {};
  let keys = [];

  // IF it is a canonical neo4J node
  if (Array.isArray(record._fields)) {
    keys = record.keys;

    Object.keys(record._fieldLookup).forEach((key) => {
      const idx = record._fieldLookup[key];
      const _field = record._fields[idx];
      results[key] = neo4jFieldMapper(_field);
    });
  }

  verbose('neo4jRecordMapper: results expected <Keys>:', keys);
  //

  if (keys.length === 1) {
    return results[keys[0]];
  }

  // special fields starting with '_' are NOT idenitites
  const identities = keys.filter(d => d.indexOf('_') !== 0);


  if (identities.length !== 1) {
    verbose('neo4jRecordMapper: more than one items in list <identities>:', identities);
    // nothing to do, the query is like this.
    return results;
  }

  verbose('neo4jRecordMapper: merging fields in remaining <identities> item:', identities);

  // apply related as _links
  const extras = keys.filter(d => d.indexOf('_') === 0);
  const result = results[identities[0]];
  extras.forEach((key) => {
    result[key.replace('_related_', '')] = results[key];
  });
  return result;
};

// const neo4jRecords = (res) => {
//   const _records = {};
//   debug(`find '${this.name}': neo4j success`, neo4jSummary(res));
//   for (let rec of res.records) {
//     rec = neo4jRecordMapper(rec);
//     _records[rec.uid] = rec;
//   }
//   return _records;
// };

const neo4jNodeMapper = (node) => {
  const props = {};

  Object.keys(node.properties).forEach((k) => {
    if (Array.isArray(node.properties[k])) {
      // remap, since we don't know.
      props[k] = node.properties[k].map((d) => {
        if (d.constructor.name === 'String') { return d; }
        return neo4jRecordMapper(d);
      });
    }
    if (node.properties[k] && node.properties[k].constructor) {
      switch (node.properties[k].constructor.name) {
        case 'Integer':
          props[k] = neo4jToInt(node.properties[k]);
          break;
        case 'Node':
          props[k] = neo4jNodeMapper(node.properties[k]);
          break;
        default:
          props[k] = node.properties[k];
          // none
          break;
      }
    }
  });
  return {
    // label: node.labels.slice(-1).pop(),
    labels: node.labels,
    ...props,
  };
};

const neo4jRelationshipMapper = relationship => ({
  relationship: {
    type: relationship.type,
    ...relationship.properties,
  },
});

const neo4jPathSegmentMapper = segment => ({
  start: neo4jNodeMapper(segment.start),
  end: neo4jNodeMapper(segment.end),
  relationship: {
    type: segment.relationship.type,
    ...segment.relationship.properties,
  },
});

const neo4jPathMapper = (path) => {
  debug('neo4jPathMapper: n. of segments:', path.segments.length);
  return {
    type: 'path',
    length: path.length,
    segments: path.segments.map(neo4jPathSegmentMapper),
  };
};


/**
 * Transform a natural language query to suitable lucene query string for apoc.index.search
 * used for suggestion only, this implies incomplete queries.
 */
const neo4jToLucene = (q) => {
  let _q = q.trim();
  // contains odd
  const isExactLeft = _q.indexOf('"') === 0;

  // replace characters
  _q = _q.replace(/[*"]/g, '');

  // split on spaces
  _q = _q.split(/\s/).map((d) => {
    if (isExactLeft) {
      return `"${d}"`;
    }
    return `${d}*`;
  }).join(' AND ');

  debug('neo4jToLucene: <natural query>', q, 'to <lucene query>', _q);
  return _q;
};

module.exports = {
  neo4jNow,
  neo4jPrepare,
  neo4jRecordMapper,
  neo4jRun,
  neo4jSummary,
  neo4jToInt,
  neo4jToLucene,
};
