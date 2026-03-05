import { HookContext } from '@feathersjs/feathers'
import { ImpressoApplication } from '@/types.js'

import { Collection, SearchFacetBucket } from '@/models/generated/canonical.js'
import { SearchFacet, SearchFacetRangeBucket } from '@/models/generated/deprecated/models.js'
import { BaseFindResponse } from '@/models/generated/app/responses.js'
import Newspaper from '@/models/newspapers.model.js'
import Entity from '@/models/entities.model.js'
import Topic from '@/models/topics.model.js'
import { FacetWithLabel } from '@/models/generated/canonical.js'

type SearchFacetBucketInternal = SearchFacetBucket

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
        value: typeof input.value !== 'number' ? parseInt(String(input.value)) : input.value,
      }
    case 'country':
    case 'type':
    case 'language':
    case 'accessRight':
    case 'dataDomain':
    case 'copyright':
      return {
        count: input.count,
        value: String(input.value),
      }
    case 'topic':
      const topicItem = (input as any)?.item as Topic
      return {
        count: input.count,
        value: String(input.value),
        label: topicItem?.words?.map(({ w, p }) => `${w} (${p})`).join(', '),
      }
    case 'collection':
      const collectionItem = (input as any)?.item as Collection
      return {
        count: input.count,
        value: String(input.value),
        label: collectionItem != null ? collectionItem.title : undefined,
      }
    case 'newspaper':
      const newspaperItem = (input as any)?.item as Newspaper
      return {
        count: input.count,
        value: String(input.value),
        label: newspaperItem?.name,
      }
    case 'person':
    case 'location':
    case 'nag':
    case 'organisation':
      const entityItem = (input as any)?.item as Entity
      return {
        count: input.count,
        value: String(input.value),
        label: entityItem.name,
      }
    case 'imageVisualContent':
    case 'imageTechnique':
    case 'imageCommunicationGoal':
    case 'imageContentType':
      const facetItem = (input as any)?.item as FacetWithLabel
      return {
        count: input.count,
        value: String(input.value),
        label: facetItem?.label,
      }
    default:
      return {
        count: input.count,
        value: input.value ?? '',
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
