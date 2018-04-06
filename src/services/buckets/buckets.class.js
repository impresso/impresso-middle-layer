const Neo4jService = require('../neo4j.service').Service;

class Service extends Neo4jService {

  async find (params) {
    // re-route to
    return [];
  }

  async create (data, params) {
    if (Array.isArray(data)) {
      // return oh che stai pazzo?
      return await Promise.all(data.map(current => this.create(current)));
    }
    console.log()

    //const label =
    const query = this.queries[[data.sanitized.label, 'create'].join('_')]
    console.log(data.sanitized.label,query);

    return this._run(query, {
      uid: 'github-1181642-this-is-a-test', // buckets are user specific
      name: data.sanitized.name,
      user_uid: 'github-1181642',
      uids: data.sanitized.uids
    }).then(this._finalize);
    // super.create(data, params)
    //
  }

  async update (id, data, params) {
    return data;
  }

  async patch (id, data, params) {
    return data;
  }

  async remove (id, params) {
    return { id };
  }
}

module.exports = function (options) {
  return new Service(options);
};

module.exports.Service = Service;
