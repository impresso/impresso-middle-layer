const {
  daterangeExtractor,
  newspaperExtractor,
} = require('./extractors');

const ItemsExtractors = Object.freeze({
  daterange: daterangeExtractor,
  newspaper: newspaperExtractor,
});

class FiltersItems {
  constructor(app) {
    this.app = app;
  }

  async find({ filters }) {
    const filtersWithItems = await Promise.all(filters.map(async (filter) => {
      const extractor = ItemsExtractors[filter.type];
      const items = extractor != null ? await extractor(filter, this.app) : [];
      return { filter, items };
    }));

    return {
      filtersWithItems,
    };
  }
}

module.exports = { FiltersItems };
