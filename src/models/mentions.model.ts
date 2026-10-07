import type { SuggestEntry } from '@/internalServices/simpleSolr.js'
import type {
  AggregateEntityMentionSolrDocumentV3ClassicEntityTypes,
  MediaSourceAggregateMentionSolrDocumentV1,
} from '@/models/generated/impressoSchemas/solr/semanticEnrichment.js'

type MentionSolrDocument =
  AggregateEntityMentionSolrDocumentV3ClassicEntityTypes | MediaSourceAggregateMentionSolrDocumentV1
type MentionType = 'person' | 'location' | 'organisation' | 'newsagency' | 'radiostation' | 'mention'

const MentionTypes: Readonly<Record<string, MentionType>> = {
  pers: 'person',
  loc: 'location',
  org: 'organisation',
  pressagency: 'newsagency',
  radiostation: 'radiostation',
} satisfies Record<MentionSolrDocument['ner_predicted_type_s'], MentionType>

export default class Mention {
  name: string
  frequence: number
  type: MentionType

  constructor({ name, frequence, type }: { name: string; frequence: number; type: string }) {
    this.name = name
    this.frequence = frequence
    this.type = 'mention'
    if (Object.prototype.hasOwnProperty.call(MentionTypes, type)) {
      this.type = MentionTypes[type]
    }
  }

  static solrFactory() {
    // mentionSuggest supplies surface_s as the term, ner_predicted_type_s as
    // the payload, and occurrence_count_l (including NIL occurrences) as weight.
    return (suggestion: SuggestEntry) =>
      new Mention({
        name: suggestion.term.replace(/<[^>]*>/g, ''),
        type: suggestion.payload,
        frequence: suggestion.weight,
      })
  }
}
