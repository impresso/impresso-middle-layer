const config = require('@feathersjs/configuration')()();
const debug = require('debug')('impresso/scripts:bulk');
const verbose = require('debug')('verbose:impresso/scripts:bulk');

const sequelize = require('../src/sequelize').client(config.sequelize);
const neo4j = require('../src/neo4j').client(config.neo4j);
const { neo4jPrepare, neo4jSummary } = require('../src/services/neo4j.utils');
const session = neo4j.session();

const merge = (modelName, modelMapper, limit = 100) => {
  const Klass = require(`../src/models/${modelName}.model`).model(sequelize);
  const queries = require('decypher')(`${__dirname}/../src/services/${modelName}/${modelName}.queries.cyp`);

  debug(`merge: starting ${modelName}...`);

  async function waterfall () {
    const total = await Klass.count();
    const steps = Math.ceil(total / limit);

    for(let i=0;i < steps;i++) {

      const items =  await Klass.scope('findAll').findAll({ offset: i*limit, limit: limit });
      debug(`tx starting - offset:` , i*limit, '- total:', total, '- limit:', limit);

      await session.writeTransaction((tx) => {
        for(item of items) {
          const params = {
            Project: 'impresso',
            ...  modelMapper(item)
          }
          verbose(`adding ${modelName} - uid: ${params.uid} - offset:` , i*limit, '- total:', total, params);
          tx.run(neo4jPrepare(queries.merge, params), params);
        }
      }).then(res => {
        debug(`tx success! - offset:` , i*limit, '- total:', total, '- limit:', limit);
      });
    }
  }

  debug(`merge: ${modelName} done.`);

  return waterfall();
}

const query = (modelName, queryName, items, limit = 100) => {
  const queries = require('decypher')(`${__dirname}/../src/services/${modelName}/${modelName}.queries.cyp`);

  debug(`query: executing ${modelName}/${queryName}...`);
  async function waterfall () {
    const total = items.length;
    const steps = Math.ceil(total / limit);

    for(let i=0;i < steps;i++) {
      debug(`query: tx starting - offset:` , i*limit, '- total:', total, '- limit:', limit);

      await session.writeTransaction((tx) => {
        for(item of items) {
          const params = {
            Project: 'impresso',
            ...  item
          }
          verbose(`query: adding ${modelName} - uid: ${params.uid} - offset:` , i*limit, '- total:', total, params);
          tx.run(neo4jPrepare(queries[queryName], params), params);
        }
      }).then(res => {
        debug(`query: tx success! - offset:` , i*limit, '- total:', total, '- limit:', limit);
      });
    }
  }

  return waterfall()
}

const count = (modelName, params) => {
  const queries = require('decypher')(`${__dirname}/../src/services/${modelName}/${modelName}.queries.cyp`);

  debug(`count: ${modelName} using query 'count'`);

  return session.writeTransaction((tx) => {

    return tx.run(queries.count, {
      Project: 'impresso',
      ... params
    }).then(res => {
      debug(`count: ${modelName} using query 'count' success!`);
      verbose('count: <summary>', neo4jSummary(res));
      return res;
    }) ;
  });
}

// execute custom APOC call
const apoc = (modelName, queryName, params) => {
  const queries = require('decypher')(`${__dirname}/../src/services/${modelName}/${modelName}.queries.cyp`);

  debug(`apoc: ${modelName} using query: ${queryName}.`);

  return session.writeTransaction((tx) => {
    return tx.run(queries[queryName], {
      Project: 'impresso',
      ... params
    }).then(res => {
      debug(`apoc: ${modelName} using query: ${queryName} success!`);
      verbose('apoc: <summary>', neo4jSummary(res));
      return res;
    });
  });
}

module.exports = {
  merge,
  count,
  apoc,
  query,
};
