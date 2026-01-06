import type {
  ContentItemCore,
  AccessRightFields,
  ArticleFields,
  AudioFields,
  ContextualMetadataFields,
  ImageFields,
  SemanticEnrichmentsFields,
  TextContentFields as TextContentFieldsGenerated,
} from './generated/solr/contentItem.js'

/**
 * IMPORTANT: This field should be kept in sync with the ingestion code.
 * If a new language is added explicitly as a separate field,
 * it should be reflected here.
 * https://github.com/impresso/impresso-solr-config/blob/5c1ef0bd062342329e5b6d1dcbd1ea3d2d231691/impresso2-solrcloud-configsets/cfgset_01_impresso_main/solrconfig.xml#L620
 */
export type LanguageCode = 'fr' | 'de' | 'en' | 'it' | 'es' | 'nl'
export const SupportedLanguageCodes = ['fr', 'de', 'en', 'it', 'es', 'nl'] satisfies LanguageCode[]

/**
 * JSON Schema to TS generator does not know how to generate
 * `propetryPatterns` fields so we have to define this manually.
 */
type LanguageSpecificFields = {
  /**
   * Title text in different languages, e.g. title_txt_fr, title_txt_en, etc.
   */
  [K in `title_txt_${LanguageCode}`]: string
} & {
  /**
   * Content text in different languages, e.g. content_txt_fr, content_txt_en, etc.
   */
  [K in `content_txt_${LanguageCode}`]: string
}

export type TextContentFields = TextContentFieldsGenerated & LanguageSpecificFields

export type ContentItemCoreFieldsNames = keyof ContentItemCore
export type AccessRightFieldsNames = keyof AccessRightFields
export type ArticleFieldsNames = keyof ArticleFields
export type AudioFieldsNames = keyof AudioFields
export type ContextualMetadataFieldsNames = keyof ContextualMetadataFields
export type ImageFieldsNames = keyof ImageFields
export type SemanticEnrichmentsFieldsNames = keyof SemanticEnrichmentsFields
export type TextContentFieldsNames = keyof TextContentFields

/**
 * A composite model used in the old code to refer
 * to an "article" content item.
 */
export type PrintContentItem = ArticleFields &
  TextContentFields &
  SemanticEnrichmentsFields &
  ContentItemCore &
  AccessRightFields &
  ContextualMetadataFields
