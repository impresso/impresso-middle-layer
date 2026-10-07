import type { EntitySolrDocumentV3 } from '@/models/generated/impressoSchemas/solr/semanticEnrichment.js'

type EntityCountField = Extract<keyof EntitySolrDocumentV3, `${string}_count_l`>

export function getEntitySuggestionCountField(solrType?: string): EntityCountField {
  switch (solrType) {
    case 'pers':
      return 'ner_type_pers_count_l'
    case 'loc':
      return 'ner_type_loc_count_l'
    case 'org':
      return 'ner_type_org_count_l'
    case 'pressagency':
      return 'ner_type_pressagency_count_l'
    case 'radiostation':
      return 'ner_type_radiostation_count_l'
    default:
      return 'content_item_count_l'
  }
}
