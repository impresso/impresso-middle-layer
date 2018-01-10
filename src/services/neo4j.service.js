class Neo4jService {
  constructor (options) {
    this.options = options || {};
    this._run  = options.run;
    this.project = this.options.project || '!';
    this.queries = this.options.queries || {};
  }

  find (params) {
    return this._run(this.queries.find, params.sanitized)
  }

  get (id, params) {
    return this._run(this.queries.get, {
      uid: id,
      ... params.sanitized
    })
  }
}

module.exports = function (options) {
  return new Neo4jService(options);
};

module.exports.Service = Neo4jService;
