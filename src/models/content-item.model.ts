import type {
  AccessRightFieldsNames,
  ArticleFieldsNames,
  AudioFieldsNames,
  ContentItemCoreFieldsNames,
  ContextualMetadataFieldsNames,
  SemanticEnrichmentsFieldsNames,
  TextContentFieldsNames,
} from './solr'

/**
  access & download
  permissions bitmaps
  see https://github.com/search?q=org%3Aimpresso%20rights_bm_explore_l&type=code
*/
export const RightsFields = [
  'rights_bm_explore_l',
  'rights_bm_get_tr_l',
  'rights_bm_get_img_l',
  'rights_data_domain_s',
  'rights_copyright_s',
] satisfies AccessRightFieldsNames[]

/**
 * Content item metadata fields.
 */
export const IdAndMetaFields = [
  'id', // id of the content item
  'lg_s', // language code of the content item
  'lg_orig_s', // original language code of the content item, if different from lg_s
  'item_type_s', // what type of item: article, radio, etc.

  'meta_source_medium_s', // source medium: newspaper, radio, etc.
  'meta_source_type_s',

  'meta_journal_s', // source (journal, newspaper, broadcaster)
  'meta_year_i', // dates
  'meta_date_dt',
  'meta_issue_id_s', // issue: newspaper issue, radio broadcast of the date, etc.
  'meta_country_code_s', // country of the source
  'meta_province_code_s', // province of the source
  'meta_partnerid_s', // who provided the content item to Impresso
] satisfies (ContentItemCoreFieldsNames | TextContentFieldsNames | ContextualMetadataFieldsNames)[]

/**
 * Fields found in the old code but likely not used.
 */
const SuspectedNotUsedFields: TextContentFieldsNames[] = [
  // 'doc_type_s', // content item or page
  // 'olr_b', // layout & quality
]

/**
 * All the title fields.
 */
export const TitleFields = ['title_txt_fr', 'title_txt_en', 'title_txt_de'] satisfies TextContentFieldsNames[]

/**
 * All the content fields.
 */
export const ContentFields = ['content_txt_en', 'content_txt_fr', 'content_txt_de'] satisfies TextContentFieldsNames[]

/**
 * Snippet fields.
 */
export const ExcerptFields = [
  'snippet_plain', // content excerpt
] satisfies TextContentFieldsNames[]

/**
 * Named entities and topics.
 */
export const NamedEntitiesFields = [
  'topics_dpfs', // topics IDs and scores
  'pers_entities_dpfs', // named entities
  'loc_entities_dpfs',
] satisfies SemanticEnrichmentsFieldsNames[]

export const ArticleCoordinatesFields = [
  'rc_plains', // region coordinates
] satisfies ArticleFieldsNames[]

/**
 * Article specific metadata fields.
 */
export const ArticleContentItemMetadataFields = [
  'cc_b', // do we have reliable coordinates?
  'front_b', // is it a front page?
  'page_id_ss', // page IDs where the article is located
  'page_nb_is', // page numbers where the article is located
  'nb_pages_i', // how many pages the article spans
  'content_length_i', // length of the article content
] satisfies ArticleFieldsNames[]

/**
 * Various character offsets in article text.
 */
export const AricleContentItemOffsetsAndBoundariesFields = [
  'lb_plain',
  'rb_plain',
  'pp_plain',
  'nem_offset_plain',
] satisfies ArticleFieldsNames[]

/**
 * Radio broadcast specific metadata fields.
 */
export const RadioBroadcastContentItemMetadataFields = [
  'record_id_ss',
  'record_nb_is',
  'nb_record_i',
  'meta_start_time_s',
  'meta_duration_s',
] satisfies AudioFieldsNames[]

/**
 * Radio broadcast timecode fields.
 */
export const RadioBroadcastTimecodeFields = ['rreb_plain'] satisfies AudioFieldsNames[]
