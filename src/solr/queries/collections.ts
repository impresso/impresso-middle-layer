/**
 * Contains all queries related to collections.
 */

import { SelectRequestBody } from '../../internalServices/simpleSolr'
import { CollectionItem } from '../../models/generated/solr'

/**
 * A pair of user ID and collection ID
 * needed to identify a collection item in Solr.
 */
export interface CollectionIdPair {
  userId: string
  collectionId: string
}

/**
 * Build `col_id_s` from `CollectionIdPair`.
 */
export const toCollectionId = (pair: CollectionIdPair): string => {
  return `${pair.userId}_${pair.collectionId}`
}

export const toPair = (col_id_s: string): CollectionIdPair => {
  const [userId, ...collectionIdParts] = col_id_s.split('_')
  return {
    userId,
    collectionId: collectionIdParts.join('_'),
  }
}

/**
 * Get total items counts for multiple collections.
 * The result can be found in `facet_counts.facet_fields.collections`
 */
export const queryGetItemsCountsForCollections = (paris: CollectionIdPair[]): SelectRequestBody => {
  const query = paris.map(pair => `col_id_s:${toCollectionId(pair)}`).join(' OR ')

  return {
    query,
    limit: 0,
    facet: {
      collections: {
        type: 'terms',
        field: 'col_id_s',
        limit: paris.length,
        sort: {
          index: 'asc',
        },
      },
    },
  }
}
