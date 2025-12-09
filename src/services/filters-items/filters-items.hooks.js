import { protobuf } from 'impresso-jscommons'
import { BadRequest } from '@feathersjs/errors'

const getDeserializedFilters = ({
  params: {
    query: { filters: serializedFilters },
  },
}) => {
  if (!serializedFilters) return []
  try {
    return protobuf.searchQuery.deserialize(serializedFilters).filters
  } catch (error) {
    throw new BadRequest(`Filters deserialization error: ${error.message}`)
  }
}

const deserializeFilters = context => {
  context.params.filters = getDeserializedFilters(context)
}

export default {
  before: {
    find: [deserializeFilters],
  },
}
