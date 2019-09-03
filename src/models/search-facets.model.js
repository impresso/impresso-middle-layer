const Topic = require('./topics.model');
const Newspaper = require('./newspapers.model');
const Entity = require('./entities.model');
const Collection = require('./collections.model');

const FACET_TYPES_WITH_ITEMS = ['newspaper', 'language', 'topic', 'person', 'location', 'collection'];

class SearchFacetBucket {
  constructor({
    type = 'facet',
    val = '',
    count = -1,
  } = {}) {
    this.count = parseInt(count, 10);
    this.val = String(val);

    if (FACET_TYPES_WITH_ITEMS.indexOf(type) !== -1) {
      this.uid = String(val);
      if (type === 'topic') {
        this.item = Topic.getCached(this.uid);
      } else if (type === 'newspaper') {
        this.item = Newspaper.getCached(this.uid);
      } else if (type === 'person' || type === 'location') {
        this.item = new Entity({
          uid: this.uid,
          type,
          name: Entity.getNameFromUid(this.uid),
        });
      } else if (type==='collection') {
        this.item = new Collection({
          uid: this.uid,
          name: this.uid,
        });
      }
    }
  }
}

class SearchFacet{
  constructor({
    type = 'facet',
    buckets = [],
    numBuckets = -1,
  } = {}) {
    this.type = type;
    this.numBuckets = parseInt(numBuckets, 10);
    this.buckets = buckets.map(d => new SearchFacetBucket({ type, ...d}));
  }

  getItems() {
    return this.buckets.map(({ item, count }) => ({
      ...item,
      count,
    }));
  }

}

module.exports = SearchFacet;
