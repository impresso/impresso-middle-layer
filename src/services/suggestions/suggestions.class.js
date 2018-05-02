/* eslint-disable no-unused-vars */
const chrono   = require('chrono-node');
const {neo4jRecordMapper} = require('../neo4j.utils.js');
const Neo4jService = require('../neo4j.service').Service;

class Service extends Neo4jService {

  async find (params) {
    const self = this;
    let dates = async () => {
        let asdate = chrono.parse(params.sanitized.q)
        // if a date has been recognized.
        if(asdate.length) {
          return [{
            type: 'DateRange',
            values: asdate.map(d => {
              return {
                text: d.text,
                start: d.start? d.start.knownValues: null,
                end: d.end ? d.end.knownValues: null
              }
            })
          }]
        } else return []
      };

    let entities = () => this._run(this.queries.find, params.sanitized)
      .then(result => result.records.map(neo4jRecordMapper).map(record => {
        console.log(record)
        return {
          type: 'entity',
          entity: record
        }
      }));

    // let newspapers = () => this._run()

    return await Promise.all([
      dates(),
      entities(),
      // newspapers()
    ]).then(function(values) {
      return Neo4jService.wrap(values[0].concat(values[1]))
    });
  }
}

module.exports = function (options) {
  return new Service(options);
};

module.exports.Service = Service;
