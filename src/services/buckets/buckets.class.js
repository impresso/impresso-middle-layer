const Neo4jService = require('../neo4j.service').Service;
const slugify = require('slugify')


class Service extends Neo4jService {



  async create (data, params) {
    if (Array.isArray(data)) {
      // return oh che stai pazzo?
      return await Promise.all(data.map(current => this.create(current)));
    }

    // let user__uid = params.user.uid;
    const bucket_uid = slugify(data.sanitized.name);

    // owner_uid is optional.
    if(data.sanitized.owner_uid && params.user.id != data.sanitized.owner_uid) {
      // if it is not qn admin cannot create :(
      // params.user.is_staff?
      // user_uid = data.sanitized.owner_uid;
    }

    //const label =owner_uid
    const query = this.queries[[data.sanitized.label, 'create'].join('_')]

    const queryParams = {
      user__uid: params.user.uid,
      uid: `${params.user.uid}-${bucket_uid}`,
      description: data.sanitized.description,
      name: data.sanitized.name,
      uids: data.sanitized.uids
    }

    return this._run(query, queryParams).then(this._finalize);
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
