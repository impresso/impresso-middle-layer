const debug = require('debug')('impresso/services:sequelize.utils');
const {
  Conflict, BadRequest,
} = require('@feathersjs/errors');

const Newspapers = require('../models/newspapers.model');

const models = {
  newspapers: Newspapers,
};

const sequelizeErrorHandler = (err) => {
  if (err.name === 'SequelizeUniqueConstraintError') {
    debug(`sequelize failed. ConstraintValidationFailed: ${err}`);
    throw new Conflict(`ConstraintValidationFailed: ${err.errors.map(d => d.message)}`);
  } else {
    debug('sequelize failed. Check error below.');
    debug(err);
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

    debug('resolveAsync:promise for service', g.service, idxs);

    return klass.scope('findAll').findAll({
      where: {
        uid: g.items.map(d => d.uid),
      },
    })
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
};
