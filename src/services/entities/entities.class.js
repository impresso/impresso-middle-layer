require('dotenv').config();

/* eslint-disable no-unused-vars */
const neo4j    = require('neo4j-driver').v1;
      driver   = neo4j.driver(process.env.NEO4J_HOST, neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASS)),
      queries  = require('decypher')(__dirname + '/queries.cyp');

//       
class Service {
  constructor (options) {
    this.options = options || {};
    this.session  = driver.session();
  }

  find (params) {
    return this.session.run(queries.find, {
      limit: 10
    }).then(res => {
      // console.log(_gr('    v '), _bb('success.'), res.records.length, _bb('records found.'));
      return res.records
    }).catch(err => {
      throw err
    });

    // return Promise.resolve([]);
  }

  get (id, params) {
    return Promise.resolve({
      id, text: `A new message with ID: ${id}!`
    });
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
