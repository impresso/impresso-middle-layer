const Neo4jService = require('../neo4j.service').Service;
const slugify = require('slugify')


class Service extends Neo4jService {


  async find (params) {
    // list buckets available for the authentified user.
    let user_uid = params.user.uid;

    //
    // console.log('USER IS', params.user);

    if(params.sanitized.owner_uid && params.user.id != params.sanitized.owner_uid) {
      if(params.user.is_staff){
        user_uid = params.sanitized.owner_uid
      } else {
        // raise error...
      }
    }
     // we should be sure that authentication create service points to the correct

    return this._run(this.queries.find, {
      user_uid,
      skip: params.sanitized.skip,
      limit: params.sanitized.limit
    }).then(this._finalize);
  }

  async create (data, params) {
    if (Array.isArray(data)) {
      // return oh che stai pazzo?
      return await Promise.all(data.map(current => this.create(current)));
    }

    let user_uid = params.user.id;
    const bucket_uid = slugify(data.sanitized.name);

    // owner_uid is optional.
    if(data.sanitized.owner_uid && params.user.id != data.sanitized.owner_uid) {
      // if it is not qn admin cannot create :(
      // params.user.is_staff?
      // user_uid = data.sanitized.owner_uid;
    }

    //const label =owner_uid
    const query = this.queries[[data.sanitized.label, 'create'].join('_')]

    return this._run(query, {
      uid: `${user_uid}-${bucket_uid}`, // buckets are user specific unique
      name: data.sanitized.name,
      description: data.sanitized.description,
      user_uid: user_uid,
      uids: data.sanitized.uids
    }).then(this._finalize)
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
