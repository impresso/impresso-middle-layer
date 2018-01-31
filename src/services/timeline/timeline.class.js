/* eslint-disable no-unused-vars */
const queries = require('decypher')(__dirname + '/queries.cyp');
const Neo4jService = require('../neo4j.service').Service;


class Service extends Neo4jService {
  // return the related cypher query according to label and suffix.
  _query (label, suffix) {
    console.log('QUERY:', [label, suffix].join('_'));
    return queries[[label, suffix].join('_')]
  }

  // tuimeline for classes of objects
  find (params) {
    // we need to add:
    // http://www.letempsarchives.ch/graph/serie?sources%5B%5D=GDL&sources%5B%5D=JDG&sources%5B%5D=LNQ&term=amsterdam
    // optional uid, compulsory "label"...
    // validate against labels, cannot be called directly (/timeline) @todo
    let q = this._query(params.query.label, 'timeline_by_year')
    return this._run(q, {...params.sanitized, uid: params.query.uid})
  }

  get (id, params) {
    return this._run(this._query(params.query.label, 'timeline_by_year'), {
      uid: id,
      ... params.sanitized
    })
  }
}

module.exports = function (options) {
  return new Service(options);
};

module.exports.Service = Service;
