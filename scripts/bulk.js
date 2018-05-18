const config = require('@feathersjs/configuration')()();
const debug = require('debug')('impresso/scripts:bulk');
const verbose = require('debug')('impresso/scripts:bulk-verbose');

const sequelize = require('../src/sequelize').client(config.sequelize);
const neo4j = require('../src/neo4j').client(config.neo4j);
const {neo4jPrepare} = require('../src/services/neo4j.utils');
const session = neo4j.session();

const merge = (modelName, modelMapper, limit = 100) => {
  const Klass = require(`../src/models/${modelName}.model`).model(sequelize);
  const queries = require('decypher')(`${__dirname}/../src/services/${modelName}/${modelName}.queries.cyp`);

  debug(`merge: starting ${modelName}...`);

  async function waterfall () {
    const total = await Klass.count();
    const steps = Math.ceil(total / limit);

    for(let i=0;i < steps;i++) {
      const items = await Klass.findAll({ offset: i*limit, limit: limit });
      debug(`tx starting - offset:` , i*limit, '- total:', total, '- limit:', limit);
      await session.writeTransaction((tx) => {
        for(item of items) {
          const params = {
            Project: 'impresso',
            ... modelMapper(item)
          }
          verbose(`adding ${modelName} - uid: ${params.uid} - offset:` , i*limit, '- total:', total);
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

const count = (modelName, params) => {
  const queries = require('decypher')(`${__dirname}/../src/services/${modelName}/${modelName}.queries.cyp`);

  return session.writeTransaction((tx) => {
    tx.run(queries.count, {
      Project: 'impresso',
      ... params
    });
  });
}

module.exports = {
  merge,
  count,
};
