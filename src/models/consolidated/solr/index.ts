import {
  ContextualMetadataFields as ContextualMetadataFieldsBase,
  AccessRightFields as AccessRightFieldsBase,
  ContentItemAudioPartSchema,
  ContentItemCoreFieldsPartOfComposedSchema,
  ContentItemPaperSupportSchemaFragment,
  ContentItemTextContentFields,
  Image2,
  SemanticEnrichmentsFieldsPartOfComposedSchema,
} from '@/models/generated/impressoSchemas/solr/contentItem.js'
import {
  TopicSolrDocument,
  TextReusePassageSchema as TextReusePassageSchemaBase,
} from '@/models/generated/impressoSchemas/solr/semanticEnrichment.js'

/**
 * Drops the `[k: string]: unknown` index signatures that the schema generator emits
 * for `additionalProperties`, so only the fields declared in the schemas remain.
 */
type Sealed<T> = {
  [K in keyof T as string extends K ? never : number extends K ? never : K]: T[K]
}

/**
 * Solr returns `*_dpfs` (dynamic payload float) fields as multi valued fields, but the
 * schemas declare them as a single string. This maps every such field to an array,
 * preserving optionality and any `null` in the declared type.
 */
type MultiValued<V> = V extends string ? string[] : V

export type DynamicPayloadFieldsAsArrays<T> = {
  [K in keyof T]: K extends `${string}_dpfs` ? MultiValued<T[K]> : T[K]
}

/**
 * Solr Image document is a combination of the core content item fields and the image-specific fields.
 */
export type Image = Sealed<
  Image2 &
    ContentItemCoreFieldsPartOfComposedSchema &
    AccessRightFields & {
      caption_txt?: string[] // a workaround for the wrong type of the field. To be removed once fixed in schema.
    }
>

export type Topic = Sealed<TopicSolrDocument>

export type CoreFields = Sealed<ContentItemCoreFieldsPartOfComposedSchema>
export type AudioFields = Sealed<ContentItemAudioPartSchema>
export type PaperFields = Sealed<ContentItemPaperSupportSchemaFragment>
export type SemanticEnrichmentsFields = DynamicPayloadFieldsAsArrays<
  // TODO: remove DynamicPayloadFieldsAsArrays when _dpfs fields are fixed
  Sealed<SemanticEnrichmentsFieldsPartOfComposedSchema> & {
    gte_multi_v256: number[] // TODO: remove when it is in the schema.
    nem_offset_plain?: string[] | null // TODO: remove when type is fixed.
  }
>
export type AccessRightFields = Sealed<AccessRightFieldsBase>
export type TextFields = Sealed<ContentItemTextContentFields>
export type ContextualMetadataFields = Sealed<ContextualMetadataFieldsBase>

export type TextReusePassageFields = Sealed<
  TextReusePassageSchemaBase &
    PaperFields & {
      // TODO: remove these fields when they are added to the schema.
      ci_id_s: string
      page_regions_plains?: string[]
    }
>
