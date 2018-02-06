const {neo4jRecordMapper} = require('../neo4j.utils.js');
const Neo4jService = require('../neo4j.service').Service;

class Service extends Neo4jService {

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

    } else if(data.sanitized.email) {
      user.uid = data.sanitized.email
      user.provider = 'local'
      user.username = data.sanitized.email
    } else {
      // badRequest.

    }

    console.log('create user:', user)
    return this._run(this.queries.create, {
      ...data.sanitized,
      ...user
    })
  
    // return data;
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

  async find (params) {
    console.log(params)
    let uid;
    if(params.sanitized.githubId) {
      uid = `github-${params.sanitized.githubId}`;
    } else if(params.sanitized.email) {
      uid = params.sanitized.email;
    } 

    return this._run(this.queries.find, {
      ...params.sanitized,
      uid
    }).then(res => {
      // add id field for oauth2. @todo change somewhere in config
      return res._records.map(d => {
        d.id = d.uid;
        return d
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
