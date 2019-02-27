const debug = require('debug')('impresso/services:sequelize.utils');
const {
  Conflict, BadRequest,
} = require('@feathersjs/errors');

const Newspapers = require('../models/newspapers.model');
const Collection = require('../models/collections.model');

const models = {
  collections: Collection,
  newspapers: Newspapers,
};

/**
 * Basic Where reducer to be used with raw queries.
 *
 * @param  {[type]} sum    [description]
 * @param  {[type]} clause [description]
 * @return {[type]}        [description]
 */
const whereReducer = (sum, clause) => {
  Object.keys(clause).forEach((k) => {
    if (k === '$or') {
      sum.push(`(${clause[k].reduce(whereReducer, []).join(' OR ')})`);
    } else if (Array.isArray(clause[k])) {
      sum.push(`${k} IN ('${clause[k].join('\',\'')}')`);
    } else if (typeof clause[k] === 'string') {
      sum.push(`${k} = '${clause[k]}'`);
    } else {
      sum.push(`${k} = ${clause[k]}`);
    }
  });
  return sum;
};

const sequelizeErrorHandler = (err) => {
  if (err.name === 'SequelizeUniqueConstraintError') {
    debug(`sequelize failed. ConstraintValidationFailed: ${err}`);
    throw new Conflict(`ConstraintValidationFailed: ${err.errors.map(d => d.message)}`);
  } else if (err.name === 'SequelizeConnectionError') {
    debug(`Connection error. ConstraintValidationFailed: ${err}`, err);
  } else {
    debug('sequelize failed. Check error below.');
    debug(err.name);
    console.error(err);
  }
  throw new BadRequest();
};

/**
 * given goups od uids and services names, get db data
 * @param {Sequelize}
 * @param  {Array} groups
 * @return {object} object resolved
*/
const resolveAsync = async (client, groups) => {
  debug('resolveAsync: ', groups);

  const promises = groups.map((g, k) => {
    const klass = models[g.service].sequelize(client);


    const idxs = {};

    // loop through group items then store the idx
    g.items.forEach((d, i) => {
      idxs[d.uid] = i;
    });

    debug('resolveAsync:promise for service', g.service, idxs, g.items.map(d => d.uid));

    return klass.scope('findAll').findAll({
      where: {
        uid: g.items.map(d => d.uid),
      },
    })
      // .then((rows) => {
      //   console.log(rows);
      //   return rows;
      // })
      .then(rows => rows.map(r => r.toJSON()))
      .then((records) => {
        // add each record to the initial group
        records.forEach((rec) => {
          groups[k].items[idxs[rec.uid]].item = rec;
        });
        return records;
      });
  });

  await Promise.all(promises).catch((err) => {
    debug('resolveAsync:promise.all throw error', err);
  });
  return groups;
};

module.exports = {
  sequelizeErrorHandler,
  resolveAsync,
  models,
  whereReducer,
};
