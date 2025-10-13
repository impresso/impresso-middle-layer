import { HookContext } from '@feathersjs/feathers'
import { ImpressoApplication } from '../types'

import {
  Collection,
  SearchFacet,
  SearchFacetBucket as SearchFacetBucketInternal,
  SearchFacetRangeBucket,
} from '../models/generated/schemas'
import { SearchFacetBucket, BaseFindResponse } from '../models/generated/schemasPublic'
import Newspaper from '../models/newspapers.model'
import Entity from '../models/entities.model'
import Topic from '../models/topics.model'

interface FacetContainer extends BaseFindResponse {
  data: SearchFacetBucket[]
}

const transformBucket = (
  input: SearchFacetBucketInternal | SearchFacetRangeBucket,
  facetType: string
): SearchFacetBucket => {
  switch (facetType) {
    case 'contentLength':
    case 'month':
    case 'textReuseClusterSize':
    case 'textReuseClusterLexicalOverlap':
    case 'textReuseClusterDayDelta':
      return {
        count: input.count,
        value: typeof input.val === 'string' ? parseInt(input.val) : input.val,
      }
    case 'country':
    case 'type':
    case 'language':
    case 'accessRight':
    case 'dataDomain':
    case 'copyright':
      return {
        count: input.count,
        value: String(input.val),
      }
    case 'topic':
      const topicItem = (input as any)?.item as Topic
      return {
        count: input.count,
        value: String(input.val),
        label: topicItem.words.map(({ w, p }) => `${w} (${p})`).join(', '),
      }
    case 'collection':
      const collectionItem = (input as any)?.item as Collection
      return {
        count: input.count,
        value: String(input.val),
        label: collectionItem != null ? collectionItem.title : undefined,
      }
    case 'newspaper':
      const newspaperItem = (input as any)?.item as Newspaper
      return {
        count: input.count,
        value: String(input.val),
        label: newspaperItem?.name,
      }
    case 'person':
    case 'location':
      const entityItem = (input as any)?.item as Entity
      return {
        count: input.count,
        value: String(input.val),
        label: entityItem.name,
      }
    default:
      return {
        count: input.count,
        value: input.val,
      }
  }
}

export const transformSearchFacet = (input: SearchFacet, context: HookContext<ImpressoApplication>): FacetContainer => {
  return {
    pagination: {
      total: input.numBuckets,
      limit: context.params?.query?.limit ?? input.buckets.length,
      offset: context.params?.query?.offset ?? 0,
    },
    data: input.buckets.map(b => transformBucket(b, context.id as string)),
  }
}
