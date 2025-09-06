class CollectableItemGroup {
  constructor ({
    itemId = '',
    contentType = '',
    collections = [],
    collectionIds = [],
    searchQueries = [],
    latestDateAdded = new Date(),
  } = {}) {
    this.itemId = String(itemId);
    this.contentType = String(contentType);
    this.collectionIds = collectionIds;
    this.searchQueries = searchQueries;

    if (!collections.length && collectionIds.length) {
      this.collections = collectionIds.map(uid => ({ uid }));
    }

    if (latestDateAdded instanceof Date) {
      this.latestDateAdded = latestDateAdded;
    } else {
      this.latestDateAdded = new Date(latestDateAdded);
    }
  }

  getService () {
    const services = {
      A: 'articles',
      E: 'entities',
      P: 'pages',
      I: 'issues',
    };
    return services[this.contentType];
  }
}

export default CollectableItemGroup;
