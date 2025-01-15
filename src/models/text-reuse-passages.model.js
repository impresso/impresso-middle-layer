import { OpenPermissions } from '../util/bigint'

const { invert } = require('lodash')
const { solrDocsMapCallbackFn } = require('../util/solr/fields')

const SolrFields = {
  id: 'id',
  contentItemId: 'ci_id_s',
  size: 'content_length_i',
  textReuseClusterId: 'cluster_id_s',
  isFront: 'front_b',
  offsetStart: 'beg_offset_i',
  offsetEnd: 'end_offset_i',
  contentTextFr: 'content_txt_fr',
  contentTextDe: 'content_txt_de',
  contentTextEn: 'content_txt_en',
  titleTextFr: 'title_txt_fr',
  titleTextDe: 'title_txt_de',
  titleTextEn: 'title_txt_en',
  date: 'meta_date_dt',
  pageNumbers: 'page_nb_is',
  pageRegions: 'page_regions_plains',

  newspaperId: 'meta_journal_s',
  issueId: 'meta_issue_id_s',
  clusterSize: 'cluster_size_l',
  connectedClusters: 'connected_clusters_ss',
  connectedClustersSize: 'n_connected_clusters_i',
  lexicalOverlap: 'cluster_lex_overlap_d',
  timeDifferenceDay: 'cluster_day_delta_i',
  collections: 'ucoll_ss',
  // bitmap permissions
  bitmapExplore: 'rights_bm_explore_l',
  bitmapGetTranscript: 'rights_bm_get_tr_l',
}

const SolrFieldsToPropsMapper = invert(SolrFields)

class TextReusePassage {
  constructor({
    id = 'id',
    contentItemId = 'ci_id_s',
    textReuseClusterId = 'cluster_id_s',
    offsetStart = 'beg_offset_i',
    offsetEnd = 'end_offset_i',
    contentTextFr,
    contentTextDe,
    contentTextEn,
    titleTextFr,
    titleTextDe,
    titleTextEn,
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
  }) {
    this.id = id
    this.article = { id: contentItemId }
    this.textReuseCluster = { id: textReuseClusterId, clusterSize }
    this.offsetStart = parseInt(offsetStart, 10)
    this.offsetEnd = parseInt(offsetEnd, 10)
    this.content = contentTextEn || contentTextDe || contentTextFr || ''
    this.title = titleTextEn || titleTextDe || titleTextFr || ''

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

  static CreateFromSolr(fieldsToPropsMapper = SolrFieldsToPropsMapper) {
    const mapFn = solrDocsMapCallbackFn(fieldsToPropsMapper, TextReusePassage)
    return doc => mapFn(doc)
  }
}

module.exports = TextReusePassage
module.exports.SolrFields = SolrFields
module.exports.SolrFieldsToPropsMapper = SolrFieldsToPropsMapper
