import { buildResolvers, CachedFacetType, ICachedResolvers } from '../internalServices/cachedResolvers'
import {
  SearchFacet as ISearchFacet,
  SearchFacetBucket as ISearchFacetBucket,
  SearchFacetRangeBucket as ISearchFacetRangeBucket,
  Topic as ITopic,
  Year as IYear,
  Entity as IEntity,
  Collection as ICollection,
  Newspaper as INewspaper,
} from './generated/schemas'
import { ImpressoApplication } from '../types'

const Topic = require('./topics.model')
const Year = require('./years.model')
const Entity = require('./entities.model')
const Collection = require('./collections.model')

type FacetType = 'newspaper' | 'language' | 'topic' | 'person' | 'location' | 'collection' | 'year'

const FACET_TYPES_WITH_ITEMS: FacetType[] = [
  'newspaper',
  'language',
  'topic',
  'person',
  'location',
  'collection',
  'year',
]

const FACET_TYPES_WITH_CACHED_ITEMS = {
  topic: Topic,
  year: Year,
}

interface SearchFacetBucketOptions {
  val: string
  count: number
  uid?: string
  item?: ITopic | IYear | IEntity | ICollection | INewspaper
}

class SearchFacetBucket implements ISearchFacetBucket {
  public count: number
  public val: string
  public uid?: string
  public item?: ITopic | IYear | IEntity | ICollection | INewspaper
  public lower?: number
  public upper?: number

  constructor({ val, uid, count, item }: SearchFacetBucketOptions) {
    this.count = typeof count == 'string' ? parseInt(count, 10) : count
    this.val = val
    this.uid = uid
    this.item = item
  }

  static async build(
    { type, val, count }: Pick<SearchFacetBucketOptions, 'val' | 'count'> & { type: FacetType },
    resolvers: ICachedResolvers
  ) {
    const uid = String(val)
    const resolver = resolvers[type as CachedFacetType]

    const item = resolver != null ? await resolver(uid, type as CachedFacetType) : undefined

    return new SearchFacetBucket({
      val,
      count: typeof count == 'string' ? parseInt(count, 10) : count,
      uid,
      item,
    })
  }
}

interface SearchFacetRangeBucketOptions {
  count: number
  val: number | string
  gap?: number
}

class SearchFacetRangeBucket implements ISearchFacetRangeBucket {
  public count: number
  public val: number
  public lower?: number
  public upper?: number

  constructor({ val, count, gap = 0 }: SearchFacetRangeBucketOptions) {
    this.val = typeof val == 'string' ? parseInt(val, 10) : val
    this.count = typeof count == 'string' ? parseInt(count, 10) : count

    // if value is integer and gap is 1, then it's a single value
    if (val === parseInt(val as string, 10) && gap === 1) {
      // single value
      this.lower = this.upper = this.val
    } else {
      this.lower = this.val
      this.upper = this.val + gap
    }
  }
}

interface SearchFacetOptions {
  type: string
  buckets: any[]
  numBuckets: number
  min?: any
  max?: any
  gap?: any
}

export class SearchFacet implements ISearchFacet {
  constructor(
    public type: string,
    public buckets: ISearchFacetBucket[] | ISearchFacetRangeBucket[],
    public numBuckets: number,
    public gap?: { [k: string]: unknown },
    public max?: { [k: string]: unknown },
    public min?: { [k: string]: unknown }
  ) {}

  static async build(
    { type, buckets = [], numBuckets, min, max, gap }: SearchFacetOptions,
    app: ImpressoApplication
  ): Promise<SearchFacet> {
    const numBucketsValue = typeof numBuckets === 'string' ? parseInt(numBuckets, 10) : numBuckets
    const bucketsValue = gap
      ? buckets.map(d => new SearchFacetRangeBucket({ ...d, min, max, gap }))
      : await Promise.all(buckets.map(async d => await SearchFacetBucket.build({ type, ...d }, buildResolvers(app))))

    return new SearchFacet(type, bucketsValue, numBucketsValue, gap as any, max as any, min as any)
  }

  getItems() {
    return this.buckets.map(({ item, count }: any) => ({
      ...item,
      count,
    }))
  }
}
