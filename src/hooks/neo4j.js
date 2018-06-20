const { neo4jToInt } = require('../services/neo4j.utils');
const { BadRequest } = require('@feathersjs/errors');
const debug = require('debug')('impresso/hooks:neo4j');

const normalizeTimeline = () => async (context) => {
  context.result = context.result.records.map(record => ({
    t: neo4jToInt(record._fields[0]),
    w: neo4jToInt(record._fields[1]),
  }));
};

const parseJsonProperty = name => async () => {
  // context.result = context.result.records.map(record => {
  //   return {
  //     t: neo4jToInt(record._fields[0]),
  //     w: neo4jToInt(record._fields[1]),
  //   }
  // })
  debug(`parseJsonProperty: <${name}> parsed correctly.`);
};

const raiseErrorIfEmpty = (explanation = {}) => async (context) => {
  if (Array.isArray(context.result) && !context.result.length) {
    debug('raiseErrorIfEmpty: apparently context.result is empty!', context.result);
    throw new BadRequest('empty context.result', explanation);
  } else {
    debug('raiseErrorIfEmpty: context.result ok, proceed.');
  }
};

const normalizeEmptyRecords = () => async (context) => {
  // only when empty array are given
  if (Array.isArray(context.result) && !context.result.length) {
    debug('normalizeEmptyRecords: apparently context.result is empty!', context.result);
    context.result = {
      count: 0,
      records: [],
    };
  } else {
    debug('normalizeEmptyRecords: context.result ok, proceed.');
  }
};

module.exports = {
  normalizeTimeline,
  normalizeEmptyRecords,
  raiseErrorIfEmpty,
  parseJsonProperty,
};
