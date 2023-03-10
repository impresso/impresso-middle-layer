const Topic = require('./topics.model')
const Year = require('./years.model')
const Newspaper = require('./newspapers.model')
const Entity = require('./entities.model')
const Collection = require('./collections.model')

const FACET_TYPES_WITH_ITEMS = [
  'newspaper',
  'language',
  'topic',
  'person',
  'location',
  'collection',
  'year',
]
const FACET_TYPES_WITH_CACHED_ITEMS = {
  newspaper: Newspaper,
  topic: Topic,
  year: Year,
}

class SearchFacetBucket {
  constructor({ type = 'facet', val = '', count = -1 } = {}) {
    this.count = parseInt(count, 10)
    this.val = String(val)

    if (FACET_TYPES_WITH_ITEMS.indexOf(type) !== -1) {
      this.uid = String(val)
      if (FACET_TYPES_WITH_CACHED_ITEMS[type]) {
        const Klass = FACET_TYPES_WITH_CACHED_ITEMS[type]
        this.item = Klass.getCached(this.uid)
      } else if (type === 'person' || type === 'location') {
        this.item = new Entity({
          uid: this.uid,
          type,
          name: Entity.getNameFromUid(this.uid),
        })
      } else if (type === 'collection') {
        this.item = new Collection({
          uid: this.uid,
          name: this.uid,
        })
      }
    }
  }
}

class SearchFacetRangeBucket {
  constructor({ val = undefined, count = -1, min = 0, max = 0, gap = 0 } = {}) {
    this.count = parseInt(count, 10)
    this.lower = parseInt(val, 10) - min
    this.upper = Math.min(this.lower + gap, max)
    this.val = val
  }
}

class SearchFacet {
  constructor({
    type = 'facet',
    buckets = [],
    numBuckets = -1,
    min = undefined,
    max = undefined,
    gap = undefined,
  } = {}) {
    this.type = type
    this.numBuckets = parseInt(numBuckets, 10)
    this.buckets = gap
      ? buckets.map((d) => new SearchFacetRangeBucket({ ...d, min, max, gap }))
      : buckets.map((d) => new SearchFacetBucket({ type, ...d }))
    this.min = min
    this.max = max
    this.gap = gap
  }

  getItems() {
    return this.buckets.map(({ item, count }) => ({
      ...item,
      count,
    }))
  }
}

module.exports = SearchFacet
