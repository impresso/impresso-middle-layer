const {neo4jRecordMapper} = require('../neo4j.utils');
const {sequelizeRecordMapper} = require('../sequelize.utils');

// "proper" service
const Neo4jService = require('../neo4j.service').Service;


class Service {
  // extends Neo4jService {
  constructor (options) {
    this.options = options || {};
    this.neo4j = new Neo4jService(options);
    // SHOULD BE: this.sequelize = new SequelizeService({})
    this.sequelize = this.options.model.sequelize;
  }

  async find (params) {
    // get the list
    // let value = await
    this.sequelize.findAndCountAll({
      limit: 3
    }).then(res => {
      console.log(res.count, res.rows.map(sequelizeRecordMapper))
      return 'ooocococ'
    });



    return this.neo4j.find(params);
  }

  async get (id, params) {
    return this.neo4j.get(id, params);
  }

}

module.exports = function (options) {
  return new Service(options);
};

module.exports.Service = Service;


/* eslint-disable no-unused-vars */
class __Service {
  constructor (options) {
    this.options = options || {};
  }



  async get (id, params) {
    return {
      id, text: `A new message with ID: ${id}!`
    };
  }

  async create (data, params) {
    if (Array.isArray(data)) {
      return await Promise.all(data.map(current => this.create(current)));
    }

    return data;
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

// module.exports = function (options) {
//   return new Service(options);
// };

//module.exports.Service = Service;
