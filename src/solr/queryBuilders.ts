/**
 * Common query builders.
 */

import { SelectRequest } from '../internalServices/simpleSolr'

export const findByIds = (ids: string[], fields?: string[]): SelectRequest => {
  if (ids.length == 0) throw new Error(`${findByIds.name}: list of IDs cannot be empty`)
  return {
    body: {
      query: `id:${ids.join(' OR id:')}`,
      ...((fields?.length ?? 0) > 0 ? { fields: fields?.join(',') } : {}),
      limit: ids.length,
    },
  }
}
