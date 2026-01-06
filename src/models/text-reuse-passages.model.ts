import { OpenPermissions } from '@/util/bigint.js'
import { LanguageCode } from '@/models/solr.js'
import { AllDocumentFields } from '@/models/text-reuse-passage.js'

interface ITRPassageConstructor {
  id?: string
  contentItemId?: string
  textReuseClusterId?: string
  offsetStart?: string | number
  offsetEnd?: string | number
  contentText?: string
  titleText?: string
  date?: string
  pageNumbers?: number[]
  pageRegions?: string[]
  clusterSize?: number
  connectedClusters?: string[]
  newspaperId?: string
  issueId?: string
  isFront?: boolean
  lexicalOverlap?: number
  timeDifferenceDay?: number
  size?: number
  collections?: string[]
  bitmapExplore?: string | number
  bitmapGetTranscript?: string | number
}

interface ITextReusePassage {
  id: string
  article: {
    id: string
  }
  textReuseCluster: {
    id: string
    clusterSize?: number
    lexicalOverlap?: number
    timeDifferenceDay?: number
  }
  offsetStart: number
  offsetEnd: number
  content: string
  title: string
  date?: string
  pageNumbers: number[]
  pageRegions?: string[]
  newspaper?: {
    id: string
  }
  issue?: {
    id: string
  }
  isFront?: boolean
  size?: number
  connectedClusters?: {
    id: string
  }[]
  collections: string[]
  bitmapExplore: bigint
  bitmapGetTranscript: bigint
}

// omit variable text fields
type MappedConstructorFields = keyof Omit<ITRPassageConstructor, 'contentText' | 'titleText'>

const SolrFields = {
  id: 'id', //
  contentItemId: 'ci_id_s',
  size: 'content_length_i',
  textReuseClusterId: 'cluster_id_s',
  isFront: 'front_b',
  offsetStart: 'beg_offset_i',
  offsetEnd: 'end_offset_i',
  date: 'meta_date_dt',
  pageNumbers: 'page_nb_is',
  pageRegions: 'page_regions_plains',

  newspaperId: 'meta_journal_s',
  issueId: 'meta_issue_id_s',
  clusterSize: 'cluster_size_l',
  connectedClusters: 'connected_clusters_ss',
  lexicalOverlap: 'cluster_lex_overlap_d',
  timeDifferenceDay: 'cluster_day_delta_i',
  collections: 'ucoll_ss',
  // bitmap permissions
  bitmapExplore: 'rights_bm_explore_l',
  bitmapGetTranscript: 'rights_bm_get_tr_l',
} satisfies Record<MappedConstructorFields, keyof AllDocumentFields | 'ucoll_ss'>

const SolrFieldsToPropsMapper = Object.keys(SolrFields).reduce(
  (acc, prop) => {
    const typedProp = prop as MappedConstructorFields
    const field = SolrFields[typedProp]
    acc[field] = typedProp
    return acc
  },
  {} as Record<keyof AllDocumentFields | 'ucoll_ss', keyof ITRPassageConstructor>
)

class TextReusePassage implements ITextReusePassage {
  id: string
  article: {
    id: string
  }
  textReuseCluster: {
    id: string
    clusterSize?: number
    lexicalOverlap?: number
    timeDifferenceDay?: number
  }
  offsetStart: number
  offsetEnd: number
  content: string
  title: string
  date?: string
  pageNumbers: number[]
  pageRegions?: string[]
  newspaper?: {
    id: string
  }
  issue?: {
    id: string
  }
  isFront?: boolean
  size?: number
  connectedClusters?: {
    id: string
  }[]
  collections: string[]
  bitmapExplore: bigint
  bitmapGetTranscript: bigint

  constructor({
    id = 'id',
    contentItemId = 'ci_id_s',
    textReuseClusterId = 'cluster_id_s',
    offsetStart = 'beg_offset_i',
    offsetEnd = 'end_offset_i',
    contentText,
    titleText,
    date,
    pageNumbers = [],
    pageRegions,
    clusterSize,
    connectedClusters,
    newspaperId,
    issueId,
    isFront,
    lexicalOverlap,
    timeDifferenceDay,
    size,
    collections = [],
    bitmapExplore = undefined,
    bitmapGetTranscript = undefined,
  }: ITRPassageConstructor) {
    this.id = id
    this.article = { id: contentItemId }
    this.textReuseCluster = { id: textReuseClusterId, clusterSize }
    this.offsetStart = typeof offsetStart == 'string' ? parseInt(offsetStart, 10) : offsetStart
    this.offsetEnd = typeof offsetEnd == 'string' ? parseInt(offsetEnd, 10) : offsetEnd
    this.content = contentText ?? ''
    this.title = titleText ?? ''

    if (Array.isArray(connectedClusters) && connectedClusters.length) {
      this.connectedClusters = connectedClusters.map(id => ({
        id,
      }))
    }
    if (typeof isFront === 'boolean') {
      this.isFront = isFront
    }
    if (Number.isInteger(timeDifferenceDay)) {
      this.textReuseCluster.timeDifferenceDay = timeDifferenceDay
    }
    if (Number.isInteger(size)) {
      this.size = size
    }
    if (Number.isFinite(lexicalOverlap)) {
      this.textReuseCluster.lexicalOverlap = lexicalOverlap
    }
    if (newspaperId) {
      this.newspaper = { id: newspaperId }
    }
    if (issueId) {
      this.issue = { id: issueId }
    }

    if (date) {
      this.date = date
    }
    if (pageRegions) {
      this.pageRegions = pageRegions
    }
    this.pageNumbers = pageNumbers
    this.collections = collections

    this.bitmapExplore = BigInt(bitmapExplore ?? OpenPermissions)
    this.bitmapGetTranscript = BigInt(bitmapGetTranscript ?? OpenPermissions)
  }

  static fromSolr(doc: AllDocumentFields & { ucoll_ss?: string[] }) {
    const props: ITRPassageConstructor = Object.entries(SolrFieldsToPropsMapper).reduce((acc, [field, prop]) => {
      const typedField = field as keyof typeof SolrFieldsToPropsMapper
      acc[prop] = doc[typedField] as any
      return acc
    }, {} as ITRPassageConstructor)

    // add content and title fields
    const titleText = doc[`title_txt_${doc.lg_s as LanguageCode}`] ?? doc['title_txt']?.[0]
    const contentText = doc[`content_txt_${doc.lg_s as LanguageCode}`] ?? doc['content_txt']?.[0]

    return new TextReusePassage({ ...props, titleText, contentText, collections: doc.ucoll_ss ?? [] })
  }
}

export default TextReusePassage
export { SolrFields }
