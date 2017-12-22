
/* eslint-disable no-unused-vars */
const      queries       = require('decypher')(__dirname + '/queries.cyp');


class Service {
  constructor (options) {
    this.options = options || {};
    this.session  = options.session;
    this.project = this.options.project || '!';
    
  }

  _run (cypherQuery, params) {
    return this.session.run(cypherQuery, {
      Project: this.project,
      ... params
    })
  }

  find (params) {
    return this._run(queries.find_entities, params.sanitized)
  }

  get (id, params) {
    return this._run(queries.get_entity, {
      uid: id
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
