/* eslint-disable no-unused-vars */
const queries = require('decypher')(__dirname + '/queries.cyp');


class Service {
  constructor (options) {
    this.options = options || {};
    this._run  = options.run;
  }

  // 
  _query (label, suffix) {
    console.log('QUERY:', [label, suffix].join('_'));
    return queries[[label, suffix].join('_')]
  }

  // tuimeline for classes of objects
  find (params) {
    // optional uid, compulsory "label"...
    // validate against labels, cannot be called directly (/timeline) @todo
    let q = this._query(params.query.label, 'timeline_by_year')
    return this._run(q, {...params.sanitized, uid: params.query.uid})
  }

  get (id, params) {
    console.log('oh my goooood')
    return this._run(this._query(params.query.label, 'timeline_by_year'), {
      uid: id,
      ... params.sanitized
    })
  }

  create (data, params) {
    if (Array.isArray(data)) {
      return Promise.all(data.map(current => this.create(current)));
    }

    return Promise.resolve(data);
  }

  update (id, data, params) {
    return Promise.resolve(data);
  }

  patch (id, data, params) {
    return Promise.resolve(data);
  }

  remove (id, params) {
    return Promise.resolve({ id });
  }



}

module.exports = function (options) {
  return new Service(options);
};

module.exports.Service = Service;
