
function parseOrderBy (orderBy, keyFieldMap = {}) {
  if (orderBy == null) return [];
  const isDescending = orderBy.startsWith('-');
  const orderKey = orderBy.replace(/^-/, '');
  const field = keyFieldMap[orderKey];
  return field != null
    ? [field, isDescending]
    : [];
}

module.exports = {
  parseOrderBy,
};
