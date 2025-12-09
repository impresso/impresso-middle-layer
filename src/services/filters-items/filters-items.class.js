import {
  daterangeExtractor,
  newspaperExtractor,
  topicExtractor,
  entityExtractor,
  yearExtractor,
  collectionExtractor,
  numberRangeExtractor,
  simpleValueExtractor,
  getImageTypeExtractor,
} from './extractors'

const ItemsExtractors = Object.freeze({
  daterange: daterangeExtractor,
  newspaper: newspaperExtractor,
  topic: topicExtractor,
  person: entityExtractor,
  location: entityExtractor,
  nag: entityExtractor,
  organisation: entityExtractor,
  entity: entityExtractor,
  year: yearExtractor,
  collection: collectionExtractor,
  textReuseClusterSize: numberRangeExtractor,
  textReuseClusterLexicalOverlap: numberRangeExtractor,
  textReuseClusterDayDelta: numberRangeExtractor,
  contentLength: numberRangeExtractor,
  imageVisualContent: getImageTypeExtractor('imageVisualContent'),
  imageTechnique: getImageTypeExtractor('imageTechnique'),
  imageCommunicationGoal: getImageTypeExtractor('imageCommunicationGoal'),
  imageContentType: getImageTypeExtractor('imageContentType'),
})

class FiltersItems {
  constructor(app) {
    this.app = app
  }

  async find({ filters }) {
    const filtersWithItems = await Promise.all(
      filters.map(async filter => {
        const extractor = ItemsExtractors[filter.type] || simpleValueExtractor
        const items = await extractor(filter, this.app)
        return { filter, items }
      })
    )

    return {
      filtersWithItems,
    }
  }
}

export { FiltersItems }
