const {neo4jRecordMapper} = require('../neo4j.utils.js');
const Neo4jService = require('../neo4j.service').Service;
const errors = require('@feathersjs/errors');
const {encrypt} = require('../../crypto');

class Service extends Neo4jService {
  // async get (id, params) {
  //   // console.log(params)
  //   return {
  //     id,
  //     text: `A new message with ID: ${id}!`
  //   };
  // }
  //

  async create (data, params) {
    // create multiple only if user is admin @todo!
    // if (Array.isArray(data)) {
    //   return await Promise.all(data.map(current => this.create(current)));
    // }
    // get github id!
    // console.log('create user:',data, params)
    let user = {};

    if(params.oauth && params.oauth.provider == 'github' && data.github) {
      // github oauth success, the github object is filled with interesting data.
      user.uid           = `github-${data.githubId}`;
      user.provider      = 'github';
      user.username      = data.github.profile.username;
      user.password      = '';
      user.displayname   = data.github.profile.displayName;
      user.picture       = data.github.profile.photos.map(d => d.value);

    } else if(data.sanitized.email && data.sanitized.password && data.sanitized.username) {
      user.uid = data.sanitized.email
      user.provider = 'local'
      user.username = data.sanitized.username
      Object.assign(user, encrypt(data.sanitized.password))
    } else {
      throw new errors.BadRequest({
        message:'MissingParameters'
      })
    }

    return this._run(this.queries.create, {
      ...data.sanitized,
      ...user
    }).then(res => {
      console.log(res.records, res)
      return res.records.map(neo4jRecordMapper).map(d => {
        d.id = d.uid;
        return d
      })
    })

    // return data;
  }

  async update (id, data, params) {
    return data;
  }

  async patch (id, data, params) {
    console.log('pathc', id, data);
    console.log('PATCH provider:', params.oauth.provider)
    return {
      id
    };
  }

  async remove (id, params) {
    return { id };
  }

  async find (params) {
    const user_uid = params.authenticated? params.user.uid: undefined;

    let uid = undefined;

    if(params.sanitized.githubId) {
      uid = `github-${params.sanitized.githubId}`;
    } else if(params.sanitized.email) {
      uid = params.sanitized.email;
    }
    return this._run(this.queries.find, {
      ...params.query,
      uid,
      user_uid
    }).then(res => {
      // console.log(res, uid)
      // add id field for oauth2. @todo change somewhere in config
      return res.records.map(neo4jRecordMapper).map(user => {
        // console.log(user)
        user.id = user.uid;
        return user
      })
    })
  }
}

module.exports = function (options) {
  return new Service(options);
};

module.exports.Service = Service;


// class Service {
//   constructor (options) {
//     this.options = options || {};
//   }

//   async find (params) {
//     return [];
//   }

//   async get (id, params) {
//     return {
//       id, text: `A new message with ID: ${id}!`
//     };
//   }



//   async update (id, data, params) {
//     return data;
//   }

//   async patch (id, data, params) {
//     return data;
//   }

//   async remove (id, params) {
//     return { id };
//   }
// }

// module.exports = function (options) {
//   return new Service(options);
// };

// module.exports.Service = Service;
