import type {
  ContentItem as ContentItemGenerated,
  ArticleContentItemFields,
  RadioBroadcastContentItemFields,
} from './generated/solr'

type LanguageCode = string

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

export type ContentItem = ContentItemGenerated & LanguageSpecificFields

export type ContentItemGenericFieldNames = keyof ContentItem
export type ArticleContentItemFieldNames = keyof ArticleContentItemFields
export type RadioBroadcastContentItemFieldNames = keyof RadioBroadcastContentItemFields
export type ContentItemFieldNames =
  | ContentItemGenericFieldNames
  | ArticleContentItemFieldNames
  | RadioBroadcastContentItemFieldNames

export { ArticleContentItemFields, RadioBroadcastContentItemFields }
