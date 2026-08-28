import {
  AccessRightFields,
  ContentItemCoreFieldsPartOfComposedSchema,
  Image2,
} from '@/models/generated/impressoSchemas/solr/contentItem.js'
import { TopicSolrDocument } from '@/models/generated/impressoSchemas/solr/semanticEnrichment.js'

/**
 * Drops the `[k: string]: unknown` index signatures that the schema generator emits
 * for `additionalProperties`, so only the fields declared in the schemas remain.
 */
type Sealed<T> = {
  [K in keyof T as string extends K ? never : number extends K ? never : K]: T[K]
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
