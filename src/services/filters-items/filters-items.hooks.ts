import jscommons, { Filter } from 'impresso-jscommons'
import { BadRequest } from '@feathersjs/errors'
import type { HookContext } from '@feathersjs/feathers'
const { protobuf } = jscommons

const getDeserializedFilters = ({
  params: {
    query: { filters: serializedFilters },
  },
}: HookContext): Filter[] => {
  if (!serializedFilters) return []

  try {
    return protobuf.searchQuery.deserialize(serializedFilters).filters
  } catch (error: Error | any) {
    throw new BadRequest(`Filters deserialization error: ${error.message}`)
  }
}

const deserializeFilters = (context: HookContext): void => {
  context.params.filters = getDeserializedFilters(context)
}

export default {
  before: {
    find: [deserializeFilters],
  },
}
