const { protobuf } = require('impresso-jscommons');
const { BadRequest } = require('@feathersjs/errors');

const getDeserializedFilters = ({ params: { query: { filters: serializedFilters } } }) => {
  if (!serializedFilters) return [];
  try {
    return protobuf.searchQuery.deserialize(serializedFilters).filters;
  } catch (error) {
    throw new BadRequest(`Filters deserialization error: ${error.message}`);
  }
};

const deserializeFilters = (context) => {
  context.params.filters = getDeserializedFilters(context);
};

module.exports = {
  before: {
    find: [
      deserializeFilters,
    ],
  },
};
