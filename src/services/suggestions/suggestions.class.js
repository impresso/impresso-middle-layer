/* eslint-disable no-unused-vars */
const chrono = require('chrono-node');
const { neo4jRecordMapper } = require('../neo4j.utils.js');
const Neo4jService = require('../neo4j.service').Service;

class Service extends Neo4jService {
  async find(params) {
    const self = this;
    const dates = async () => {
      const asdate = chrono.parse(params.query.q);
      // if a date has been recognized.
      if (asdate.length) {
        return [{
          type: 'DateRange',
          values: asdate.map(d => ({
            text: d.text,
            start: d.start ? d.start.knownValues : null,
            end: d.end ? d.end.knownValues : null,
          })),
        }];
      } return [];
    };

    const entities = () => this._run(this.queries.find, params.query)
      .then(result => result.records.map(neo4jRecordMapper).map(record =>
        // console.log(record)
        ({
          type: 'entity',
          entity: record,
        })));

    // let newspapers = () => this._run()

    return await Promise.all([
      dates(),
      entities(),
      // newspapers()
    ]).then(values => Neo4jService.wrap(values[0].concat(values[1])));
  }
}

module.exports = function (options) {
  return new Service(options);
};

module.exports.Service = Service;
