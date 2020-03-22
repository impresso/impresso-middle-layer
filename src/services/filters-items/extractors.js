const newspapersIndex = require('../../data')('newspapers');
const Topic = require('../../models/topics.model');
const Entity = require('../../models/entities.model');
const Year = require('../../models/years.model');


function daterangeExtractor({ q = '' }) {
  const [start, end] = Array.isArray(q)
    ? q
    : q.trim().split(' TO ');
  return start && end
    ? [{ start, end }]
    : [];
}

function newspaperExtractor({ q = '' }) {
  const codes = Array.isArray(q) ? q : [q];
  return codes.map(code => newspapersIndex.values[code.trim()] || {});
}

function topicExtractor({ q = '' }) {
  const items = Array.isArray(q) ? q : [q];
  return items
    .map(item => Topic.getCached(item.trim()))
    .filter(item => item != null);
}

function entityExtractor({ q = '' }) {
  const items = Array.isArray(q) ? q : [q];
  return items
    .map(item => Entity.getCached(item.trim()))
    .filter(item => item != null);
}

function yearExtractor({ q = '' }) {
  const items = Array.isArray(q) ? q : [q];
  return items
    .map(item => Year.getCached(item.trim()))
    .filter(item => item != null);
}

async function collectionExtractor({ q = '' }, app) {
  const items = Array.isArray(q) ? q : [q];

  try {
    return await Promise.all(items.map(async (item) => {
      const payload = { query: { nameOnly: true } };
      return app.service('collections').get(item.trim(), payload);
    }));
  } catch (error) {
    if (error.name === 'NotFound') return [];
    throw error;
  }
}

function numberRangeExtractor({ q = '' }) {
  const [start, end] = Array.isArray(q)
    ? q
    : q.trim().split(' TO ');
  return start && end
    ? [{ start: parseInt(start, 10), end: parseInt(end, 10) }]
    : [];
}

function simpleValueExtractor({ q = '' }) {
  const items = Array.isArray(q)
    ? q
    : [q.trim()];
  return items.map(uid => ({ uid }));
}

module.exports = {
  daterangeExtractor,
  newspaperExtractor,
  topicExtractor,
  entityExtractor,
  yearExtractor,
  collectionExtractor,
  numberRangeExtractor,
  simpleValueExtractor,
};
