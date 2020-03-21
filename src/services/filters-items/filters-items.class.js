const {
  daterangeExtractor,
  newspaperExtractor,
  topicExtractor,
  entityExtractor,
  yearExtractor,
  collectionExtractor,
  numberRangeExtractor,
  simpleValueExtractor,
} = require('./extractors');

const ItemsExtractors = Object.freeze({
  daterange: daterangeExtractor,
  newspaper: newspaperExtractor,
  topic: topicExtractor,
  person: entityExtractor,
  location: entityExtractor,
  year: yearExtractor,
  collection: collectionExtractor,
  textReuseClusterSize: numberRangeExtractor,
  textReuseClusterLexicalOverlap: numberRangeExtractor,
  textReuseClusterDayDelta: numberRangeExtractor,
});

class FiltersItems {
  constructor(app) {
    this.app = app;
  }

  async find({ filters }) {
    const filtersWithItems = await Promise.all(filters.map(async (filter) => {
      const extractor = ItemsExtractors[filter.type] || simpleValueExtractor;
      const items = await extractor(filter, this.app);
      return { filter, items };
    }));

    return {
      filtersWithItems,
    };
  }
}

module.exports = { FiltersItems };
