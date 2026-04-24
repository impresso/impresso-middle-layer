import { Filter } from 'impresso-jscommons'
import {
  daterangeExtractor,
  newspaperExtractor,
  topicExtractor,
  entityExtractor,
  yearExtractor,
  collectionExtractor,
  integerRangeExtractor,
  floatRangeExtractor,
  simpleValueExtractor,
  getImageTypeExtractor,
  mediaSourceExtractor,
} from './extractors.js'
import { ImpressoApplication } from '@/types.js'

type Extractor = (filter: Filter, app: ImpressoApplication) => Promise<unknown[]> | unknown[]

const ItemsExtractors: Record<string, Extractor> = {
  daterange: daterangeExtractor,
  newspaper: newspaperExtractor,
  mediaSource: mediaSourceExtractor,
  topic: topicExtractor,
  person: entityExtractor,
  location: entityExtractor,
  nag: entityExtractor,
  organisation: entityExtractor,
  entity: entityExtractor,
  year: yearExtractor,
  collection: collectionExtractor,
  textReuseClusterSize: integerRangeExtractor,
  textReuseClusterLexicalOverlap: integerRangeExtractor,
  textReuseClusterDayDelta: integerRangeExtractor,
  contentLength: integerRangeExtractor,
  ocrQuality: floatRangeExtractor,
  imageVisualContent: getImageTypeExtractor('imageVisualContent'),
  imageTechnique: getImageTypeExtractor('imageTechnique'),
  imageCommunicationGoal: getImageTypeExtractor('imageCommunicationGoal'),
  imageContentType: getImageTypeExtractor('imageContentType'),
}

export class FiltersItems {
  private app: ImpressoApplication

  constructor(app: ImpressoApplication) {
    this.app = app
  }

  async find({ filters }: { filters: Filter[] }): Promise<{ filtersWithItems: any[] }> {
    const filtersWithItems = await Promise.all(
      filters.map(async filter => {
        const extractor = ItemsExtractors[filter.type] ?? simpleValueExtractor
        const items = await extractor(filter, this.app)
        return { filter, items }
      })
    )
    return { filtersWithItems }
  }
}
