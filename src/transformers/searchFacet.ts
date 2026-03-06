import { ImpressoApplication } from '@/types.js'
import { HookContext } from '@feathersjs/feathers'

import { BaseFindResponse } from '@/models/generated/app/responses.js'
import { Collection, Entity, FacetWithLabel, MediaSource, SearchFacetBucket } from '@/models/generated/canonical.js'
import {
  SearchFacet,
  SearchFacetBucket as SearchFacetBucketInternal,
  SearchFacetRangeBucket,
} from '@/models/generated/deprecated/models.js'
import Topic from '@/models/topics.model.js'

interface FacetContainer extends BaseFindResponse {
  data: SearchFacetBucket[]
}

const isSearchFacetBucketWithLabel = (
  input: SearchFacetBucket | SearchFacetRangeBucket
): input is SearchFacetBucket & { label: string } => {
  if ((input as any)['lower'] || (input as any)['upper']) return false
  return 'label' in input && input.label != null
}

type Input = SearchFacetBucket | SearchFacetBucketInternal | SearchFacetRangeBucket

const isInternalBucketWithItem = (input: Input): input is SearchFacetBucketInternal => {
  return 'item' in input
}

const transformBucket = (input: Input, facetType: string): SearchFacetBucket => {
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
        ...(isSearchFacetBucketWithLabel(input) ? { label: String(input.label) } : {}),
      }
    case 'topic':
      const topicItem = isInternalBucketWithItem(input) ? (input.item as Topic) : undefined
      const topicLabel =
        (isSearchFacetBucketWithLabel(input) ? input.label : undefined) ??
        topicItem?.words?.map(({ w, p }) => `${w} (${p})`).join(', ')
      return {
        count: input.count,
        value: String(input.value),
        ...(topicLabel != null ? { label: topicLabel } : {}),
      }
    case 'collection':
      const collectionItem = isInternalBucketWithItem(input) ? (input.item as Collection) : undefined
      const collectionLabel = isSearchFacetBucketWithLabel(input) ? input.label : collectionItem?.title
      return {
        count: input.count,
        value: String(input.value),
        ...(collectionLabel != null ? { label: collectionLabel } : {}),
      }
    case 'newspaper':
      const newspaperItem = isInternalBucketWithItem(input) ? (input.item as MediaSource) : undefined
      const newspaperLabel = isSearchFacetBucketWithLabel(input) ? input.label : newspaperItem?.name
      return {
        count: input.count,
        value: String(input.value),
        ...(newspaperLabel != null ? { label: newspaperLabel } : {}),
      }
    case 'person':
    case 'location':
    case 'nag':
    case 'organisation':
      const entityItem = isInternalBucketWithItem(input) ? (input.item as Entity) : undefined
      const entityLabel = isSearchFacetBucketWithLabel(input) ? input.label : entityItem?.name
      return {
        count: input.count,
        value: String(input.value),
        ...(entityLabel != null ? { label: entityLabel } : {}),
      }
    case 'imageVisualContent':
    case 'imageTechnique':
    case 'imageCommunicationGoal':
    case 'imageContentType':
      const facetItem = isInternalBucketWithItem(input) ? (input.item as FacetWithLabel) : undefined
      const facetLabel = isSearchFacetBucketWithLabel(input) ? input.label : facetItem?.label
      return {
        count: input.count,
        value: String(input.value),
        ...(facetLabel != null ? { label: facetLabel } : {}),
      }
    default:
      return {
        count: input.count,
        value: input.value ?? '',
        ...(isSearchFacetBucketWithLabel(input) ? { label: input.label } : {}),
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
