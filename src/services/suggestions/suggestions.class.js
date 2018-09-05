/* eslint-disable no-unused-vars */
const chrono = require('chrono-node');
const moment = require('moment');
const { neo4jRecordMapper, neo4jToLucene } = require('../neo4j.utils.js');
const Neo4jService = require('../neo4j.service').Service;

const MULTI_YEAR_RANGE = /^\s*(\d{4})(\s*(to|-)\s*(\d{4})\s*)?$/;

class Service extends Neo4jService {
  async find(params) {
    const self = this;

    const articletitles = async () => {

    };

    const dateranges = async () => {
      const myears = params.query.q.match(MULTI_YEAR_RANGE);

      if (myears) {
        const start = moment.utc(`${myears[1]}-01-01`).format();
        const end = moment.utc(myears[4] ? `${myears[4]}-12-31` : `${myears[1]}-12-31`).endOf('day').format();

        return [{
          type: 'daterange',
          context: 'include',
          daterange: `${start} TO ${end}`,
        }];
      }
      // if a date hasnt been recognized by our basic regex.
      const asdate = chrono.parse(params.query.q);

      if (asdate.length) {
        return asdate.map((d) => {
          if (!d.start) {
            return false;
          }
          const start = moment.utc(d.start.date()).format();
          let end;
          if (d.end && d.end.knownValues.day) {
            end = moment.utc(d.end.date()).endOf('day').format();
          } else if (d.end && d.end.knownValues.month) {
            end = moment.utc(d.end.date()).endOf('month').format();
          } else if (d.end && d.end.knownValues.month) {
            end = moment.utc(d.end.date()).endOf('year').format();
          } else if (d.start.knownValues.day) {
            end = moment.utc(d.start.date()).endOf('day').format();
          } else if (d.start.knownValues.month) {
            end = moment.utc(d.start.date()).endOf('month').format();
          } else if (d.start.knownValues.year) {
            end = moment.utc(d.start.date()).endOf('year').format();
          }

          if (!end) {
            return false;
          }
          return {
            type: 'daterange',
            text: d.text,
            context: 'include',
            daterange: `${start} TO ${end}`,
          };
        }).filter(d => d !== false);
      }

      return [];
    };

    const qToLucene = neo4jToLucene(params.query.q);

    const entities = async () => this._run(this.queries.find, {
      ...params.query,
      q: qToLucene,
    })
      .then(result => result.records.map(neo4jRecordMapper).map(record =>
        // console.log(record)
        ({
          type: 'entity',
          entity: record,
        })));

    // let newspapers = () => this._run()
    const results = await Promise.all([
      dateranges(), // dates(),
      entities(),
      // newspapers()
    ]).then(values => Neo4jService.wrap(values[0].concat(values[1])));

    return results;
  }
}

module.exports = function (options) {
  return new Service(options);
};

module.exports.Service = Service;
