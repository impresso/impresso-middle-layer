import {
  AccessRightFields,
  ArticleFields,
  ContentItemCore,
  ContextualMetadataFields,
  ImageFields,
} from './generated/solr/contentItem.js'
import { LanguageCode, TextContentFields } from './solr.js'

const TRPassageCoreFields = [
  'id',
  'meta_issue_id_s',
  'meta_source_type_s',
  'meta_date_dt',
  'meta_journal_s',
] satisfies (keyof ContentItemCore)[]

const TRPassageImageFields = ['front_b'] satisfies (keyof ImageFields)[]

const TRPassageContextualMetadataFields = [
  'meta_country_code_s',
  'meta_province_code_s',
  'meta_partnerid_s',
] satisfies (keyof ContextualMetadataFields)[]

const TRPassageAccessFields = [
  'rights_copyright_s',
  'rights_data_domain_s',
  'rights_bm_explore_l',
  'rights_bm_get_tr_l',
  'rights_bm_get_img_l',
] satisfies (keyof AccessRightFields)[]

interface IWildcardTextFields {
  'title_txt_*': string
  'content_txt_*': string
}

const WildcardTextFields = ['title_txt_*', 'content_txt_*'] satisfies (keyof IWildcardTextFields)[]

const TRPassageTextFields = [
  'lg_s',
  'title_txt',
  'content_txt',
  'content_length_i',
  'snippet_plain',
] satisfies (keyof TextContentFields)[]

const TRPassageArticleFields = [
  'ci_id_s',
  'cluster_id_s',
  'beg_offset_i',
  'end_offset_i',
  'page_nb_is',
  'page_regions_plains',
  'cluster_size_l',
] satisfies (keyof ArticleFields)[]

export interface IClusterFields {
  connected_clusters_ss?: string[]
  n_connected_clusters_i?: number
  cluster_lex_overlap_d?: number
  cluster_day_delta_i?: number
}

const TRPassageClusterFields = [
  'connected_clusters_ss',
  'n_connected_clusters_i',
  'cluster_lex_overlap_d',
  'cluster_day_delta_i',
] satisfies (keyof IClusterFields)[]

//   '',
// n_connected_clusters_i
// cluster_lex_overlap_d
// cluster_day_delta_i
// ucoll_ss

export type AllDocumentFields = Pick<ContentItemCore, (typeof TRPassageCoreFields)[0]> &
  Pick<ContextualMetadataFields, (typeof TRPassageContextualMetadataFields)[0]> &
  Pick<AccessRightFields, (typeof TRPassageAccessFields)[0]> &
  Pick<TextContentFields, (typeof TRPassageTextFields)[0]> &
  Pick<TextContentFields, `title_txt_${LanguageCode}` | `content_txt_${LanguageCode}`> &
  Pick<ImageFields, (typeof TRPassageImageFields)[0]> &
  Pick<ArticleFields, (typeof TRPassageArticleFields)[0]> &
  Pick<IClusterFields, (typeof TRPassageClusterFields)[0]>
