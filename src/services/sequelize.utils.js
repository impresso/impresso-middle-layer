const debug = require('debug')('impresso/services:sequelize.utils');

const Newspapers = require('../models/newspapers.model');

const models = {
  newspapers: Newspapers,
};

const sequelizeRecordMapper = record =>
  /*
   transform an array of sequelize model isntance to a nice Object
   [ newspaper {
     dataValues: { id: 1, uid: 'GDL', name: 'Journal de Geneve' },
     _previousDataValues: { id: 1, uid: 'GDL', name: 'Journal de Geneve' },
     _changed: {},
     _modelOptions:
    ...
   ]
  */
  record.toJSON();

/**
 * @param {Sequelize}
 * @param  {Array} groups
 * @return {object} object resolved
*/
const resolveAsync = async (client, groups) => {
  debug('resolveAsync: ', groups);

  const promises = groups.map((g, k) => {
    const klass = models[g.service].model(client);


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
  console.log(groups[0].items);
  return groups;
  //   .filter(d => d.uids.length)
  //   .map(d => this.app.service(d.service).get(d.uids.join(','), {
  //     query: {},
  //     user: params.user,
  //     findAll: true, // this makes "findall" explicit, thus forcing the result as array
  //   })).value())
};

module.exports = {
  sequelizeRecordMapper,
  resolveAsync,
  models,
};
