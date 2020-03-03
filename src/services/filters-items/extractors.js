const newspapersIndex = require('../../data')('newspapers');
const Topic = require('../../models/topics.model');
const Entity = require('../../models/entities.model');
const Year = require('../../models/years.model');


function daterangeExtractor({ q = '' }) {
  const [start, end] = q.trim().split(' TO ');
  return start && end
    ? [{ start, end }]
    : [];
}

function newspaperExtractor({ q = '' }) {
  const item = newspapersIndex.values[q.trim()];
  return item != null ? [item] : [];
}

function topicExtractor({ q = '' }) {
  const item = Topic.getCached(q.trim());
  return item != null ? [item] : [];
}

function entityExtractor({ q = '' }) {
  const item = Entity.getCached(q.trim());
  return item != null ? [item] : [];
}

function yearExtractor({ q = '' }) {
  const item = Year.getCached(q.trim());
  return item != null ? [item] : [];
}

async function collectionExtractor({ q = '' }, app) {
  try {
    const collection = await app.service('collections').get(q.trim(), { query: { nameOnly: true } });
    return collection ? [collection] : [];
  } catch (error) {
    if (error.name === 'NotFound') return [];
    throw error;
  }
}

module.exports = {
  daterangeExtractor,
  newspaperExtractor,
  topicExtractor,
  entityExtractor,
  yearExtractor,
  collectionExtractor,
};
