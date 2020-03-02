const newspapersIndex = require('../../data')('newspapers');

function daterangeExtractor({ q = '' }) {
  const [start, end] = q.split(' TO ');
  return start && end
    ? [{ start, end }]
    : [];
}

function newspaperExtractor({ q = '' }) {
  const item = newspapersIndex.values[q.trim()];
  return item != null ? [item] : [];
}


module.exports = {
  daterangeExtractor,
  newspaperExtractor,
};
