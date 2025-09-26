/**
 * Contains all queries related to collections.
 */

import { Bucket, SelectRequestBody, TermsFacetDetails } from '../../internalServices/simpleSolr'
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

/**
 * Returns a facet query that gets collections referencing any of the given content items
 * broken down by content item ID.
 */
export const queryGetCollectionsByContentItems = (
  contentItemsIds: string[],
  includePublic = false,
  userId?: string
): SelectRequestBody => {
  if (contentItemsIds.length === 0) {
    throw new Error('contentItemsIds must not be empty')
  }

  const contentItemsQuery = `ci_id_s:(${contentItemsIds.join(' OR ')})`
  const visibilityQuery = includePublic ? 'vis_s:pub' : undefined
  const userQuery = userId ? `col_id_s:${userId}_*` : undefined

  const secondaryCondition = (() => {
    if (visibilityQuery == null && userQuery == null) {
      throw new Error('Either userId must be provided or includePublic must be true')
    }
    if (visibilityQuery != null && userQuery != null) {
      return `(${visibilityQuery} OR ${userQuery})`
    }
    if (visibilityQuery != null) {
      return visibilityQuery
    }
    return userQuery!
  })()

  const query = `(${contentItemsQuery}) AND ${secondaryCondition}`

  return {
    query,
    limit: 0,
    facet: {
      contentItemIds: {
        type: 'terms',
        field: 'ci_id_s',
        limit: contentItemsIds.length,
        facet: {
          collections: {
            type: 'terms',
            field: 'col_id_s',
            limit: -1,
            sort: {
              index: 'asc',
            },
          },
        },
      },
    },
  }
}

export type CollectionsByContentItemIdBucket = Bucket & {
  collections: TermsFacetDetails<Bucket>
}
