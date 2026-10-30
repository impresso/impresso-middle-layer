import type { EntitySolrDocumentV3 } from '@/models/generated/impressoSchemas/solr/semanticEnrichment.js'
import type { EntityDetails } from '@/models/generated/deprecated/models.js'
import type { SuggestEntry } from '@/internalServices/simpleSolr.js'
import { TypeShorthandToType } from '@/utils/entity.utils.js'

export default class Entity implements EntityDetails {
  id: string
  name: string
  wikidataId?: string
  type: EntityDetails['type']
  countItems: number
  countMentions: number
  matches?: string[]
  wikidata?: EntityDetails['wikidata']

  constructor({ id, name, type, wikidataId, countItems, countMentions }: EntityDetails) {
    this.id = id
    this.name = name
    this.type = type
    this.countItems = countItems
    this.countMentions = countMentions
    if (wikidataId != null) this.wikidataId = wikidataId
  }

  static solrFactory() {
    return (doc: EntitySolrDocumentV3) =>
      new Entity({
        id: doc.id,
        name: doc.default_label_s,
        type: TypeShorthandToType[doc.ner_entity_type_s],
        wikidataId: doc.id,
        countItems: doc.content_item_count_l,
        countMentions: doc.mention_count_l ?? 0,
      })
  }

  /**
   * Builds an entity from an `e_suggester_infix` suggestion. The suggester supplies
   * the highlighted label as the term, `<id>|<type shorthand>` as the payload and
   * the entity weight. Returns `undefined` when the payload cannot be parsed.
   */
  static solrSuggestFactory() {
    return (suggestion: SuggestEntry): Entity | undefined => {
      const [id, typeShorthand] = suggestion.payload.split('|')
      const type = TypeShorthandToType[typeShorthand]
      if (!id || type == null) return undefined
      return new Entity({
        id,
        name: suggestion.term.replace(/<[^>]*>/g, ''),
        type,
        wikidataId: id,
        countItems: suggestion.weight,
        countMentions: 0,
      })
    }
  }
}

export type SuggestField = 'entitySuggest'
export const suggestField: SuggestField = 'entitySuggest'

export interface IEntitySolrHighlighting {
  entitySuggest?: string[]
}

export const SOLR_FL = [
  'id',
  'default_label_s',
  'ner_entity_type_s',
  'content_item_count_l',
  'mention_count_l',
] satisfies (keyof EntitySolrDocumentV3)[]
