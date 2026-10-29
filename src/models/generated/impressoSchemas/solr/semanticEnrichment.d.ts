
/* eslint-disable */
/**
 * This file was automatically generated from the local impresso-schemas
 * submodule by src/scripts/generate-types-from-schemas-repo.js.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
 * and run `npm run generate-types-from-schemas-repo` to regenerate this file.
 */


/**
 * Schema for topic description documents in Solr (Impresso Project)
 */
export interface TopicSolrDocument {
  /**
   * Unique identifier for the topic (format: model_id_tp{number}_{lang})
   */
  id: string;
  /**
   * Language code (ISO lowercase)
   */
  lg_s: string;
  /**
   * Topic model identifier
   */
  tp_model_s: string;
  /**
   * Topic number (integer field)
   */
  tp_nb_i: number;
  /**
   * Word probabilities in DPFS format (space-separated pairs of 'word|probability')
   */
  word_probs_dpf: string;
  /**
   * Space-separated list of topic words for suggestion/autocomplete
   */
  topic_suggest: string;
  /**
   * Optional topic description
   */
  tp_desc_s?: string;
  /**
   * Optional topic metadata
   */
  tp_meta_s?: string;
  /**
   * Topic category assigned by the label-generation model (e.g. 'advertisement', 'legal_administrative') — topic labels v3. Optional: absent on pre-v3 topic-description-only documents.
   */
  topic_type_s?: string;
  /**
   * Short human-readable topic label — topic labels v3. Optional: absent on pre-v3 topic-description-only documents.
   */
  label_short_s?: string;
  /**
   * Long-form English topic label/description, analyzed text — topic labels v3. Optional: absent on pre-v3 topic-description-only documents.
   */
  label_long_txt_en?: string;
  /**
   * Confidence level of the generated label — topic labels v3. Optional: absent on pre-v3 topic-description-only documents.
   */
  confidence_s?: "high" | "medium" | "low";
  /**
   * Representative terms backing the generated topic label — topic labels v3. Optional: absent on pre-v3 topic-description-only documents.
   */
  representative_terms_ss?: string[];
  /**
   * Attribution for the topic-label generation process (e.g. 'OpenAI') — topic labels v3. Optional: absent on pre-v3 topic-description-only documents.
   */
  generated_by_s?: string;
  [k: string]: unknown;
}

/**
 * Entity Solr document in the v3 representation: one document per non-null Wikidata QID across accepted body and title annotations from ordinary and media-source deliveries. It preserves supplied language-specific labels and a display default, selects a NER type with media-source precedence, and distinguishes unique linked-span counts, overlapping per-type evidence counts and distinct-content-item counts.
 */
export interface EntitySolrDocumentV3 {
  /**
   * Unique Wikidata identifier of the entity.
   */
  id: string;
  /**
   * Required display label. Prefer the English label, then an accepted label matching the selected Wikipedia reference language, then an accepted other-language label. If still unresolved, choose a remaining accepted label in this order: French, German, then remaining language codes alphabetically. Finally, use the Wikipedia page name. Select the Wikipedia reference independently: prefer en, fr, de, then other language codes alphabetically; break same-language ties by exact page name.
   */
  default_label_s: string;
  /**
   * Labels supplied directly by the importer in complete entity documents for Solr auto-completion. The default label comes first, followed by accepted language labels in sorted field-name order, retaining the first occurrence of each exact string without trimming, case folding or Unicode normalization. Solr stores this array; copy rules must not append default_label_s or label_* values into entitySuggest. The field remains optional at schema level for compatibility with historical documents. Distinct matching labels can still return the same QID|type payload; clients group those matches by payload and display default_label_s.
   */
  entitySuggest?: string[];
  /**
   * One type selected from accepted linked evidence for this QID across body and title and all annotation sources. Any pressagency or radiostation evidence takes precedence over ordinary types, even if less frequent. If both media-source types occur, select the one with the larger distinct linked-span count; equal media counts prefer pressagency over radiostation. With no media-source evidence, select the ordinary type with the largest distinct linked-span count; ties prefer loc, then pers, then org. Rejected annotations do not contribute. This field records one type and does not use a mixed value.
   */
  ner_entity_type_s: "pers" | "loc" | "org" | "pressagency" | "radiostation";
  /**
   * Integer number of distinct content items containing at least one accepted body or title annotation linked to this QID. Count each content item once across text parts, types and annotation sources. Former field name: article_fq_f.
   */
  content_item_count_l: number;
  /**
   * Integer number of unique accepted linked spans for this QID across body and title and all annotation sources. Span identity is (content-item id, text part, start offset, end offset, QID); type, source and surface spelling do not split it. Count an identical span once across types and sources. Different spans, content items or body/title parts remain distinct. Per-type evidence counts may overlap and their sum can exceed this total: one identical span classified as org and pressagency gives mention_count_l=1 and each corresponding per-type count=1. Former field name: mention_fq_f.
   */
  mention_count_l?: number;
  /**
   * Integer number of distinct accepted body or title spans linked to this QID with type pers. Deduplicate identical (content-item id, text part, start offset, end offset, QID) evidence within this type across annotation sources. A span may contribute to multiple type counts while contributing once to mention_count_l; per-type counts are overlapping evidence and must not be summed as a unique-span total.
   */
  ner_type_pers_count_l?: number;
  /**
   * Integer number of distinct accepted body or title spans linked to this QID with type loc. Deduplicate identical (content-item id, text part, start offset, end offset, QID) evidence within this type across annotation sources. A span may contribute to multiple type counts while contributing once to mention_count_l; per-type counts are overlapping evidence and must not be summed as a unique-span total.
   */
  ner_type_loc_count_l?: number;
  /**
   * Integer number of distinct accepted body or title spans linked to this QID with type org. Deduplicate identical (content-item id, text part, start offset, end offset, QID) evidence within this type across annotation sources. A span may contribute to multiple type counts while contributing once to mention_count_l; per-type counts are overlapping evidence and must not be summed as a unique-span total.
   */
  ner_type_org_count_l?: number;
  /**
   * Integer number of distinct accepted body or title spans linked to this QID with type pressagency. Deduplicate identical (content-item id, text part, start offset, end offset, QID) evidence within this type across annotation sources. A span may contribute to multiple type counts while contributing once to mention_count_l; per-type counts are overlapping evidence and must not be summed as a unique-span total.
   */
  ner_type_pressagency_count_l?: number;
  /**
   * Integer number of distinct accepted body or title spans linked to this QID with type radiostation. Deduplicate identical (content-item id, text part, start offset, end offset, QID) evidence within this type across annotation sources. A span may contribute to multiple type counts while contributing once to mention_count_l; per-type counts are overlapping evidence and must not be summed as a unique-span total.
   */
  ner_type_radiostation_count_l?: number;
  /**
   * Required importer-built Solr suggester payload containing the document id followed by a literal pipe and ner_entity_type_s: QID|type.
   */
  suggest_payload_s: string;
  /**
   * Optional presence scopes for this entity: the union of body/title text parts containing accepted annotations linked to this QID. Emit body before title when both are present. Scopes do not split entity identity; unique-span counts preserve text part in span identity, and distinct-content-item counts use the union across parts, types and annotation sources.
   *
   * @minItems 1
   */
  scopes_ss?: ["body" | "title", ...("body" | "title")[]];
  /**
   * Entity label in the specified supported language (ISO 639-1 code).
   *
   * This interface was referenced by `EntitySolrDocumentV3`'s JSON-Schema definition
   * via the `patternProperty` "^label_(?:en|fr|de|it|es|pt|nl|lb|rm|ca|da|sv|no|nb|nn|is|fo|fi|se|pl|cs|sk|sl|hr|bs|sr|bg|mk|ru|uk|be)_s$".
   */
  [k: string]:
    | string
    | string[]
    | "pers"
    | "loc"
    | "org"
    | "pressagency"
    | "radiostation"
    | number
    | ["body" | "title", ...("body" | "title")[]]
    | undefined;
}

/**
 * Shared aggregate-mention Solr document in the v3 representation for pers, loc, org, pressagency and radiostation. One document aggregates accepted body and title occurrences with the same exact surface and predicted type across content items and annotation sources. QID, NIL status and text part do not split its identity. The same surface with different types produces separate aggregates; their typed occurrence counts may overlap and must not be summed to infer unique entity-span totals.
 */
export interface AggregateEntityMentionSolrDocumentV3 {
  /**
   * Deterministic aggregate identifier: a1_ followed by unpadded base64url encoding of the first 16 bytes of SHA-256 of compact JSON [surface, predicted type], encoded as UTF-8 without ASCII escaping, extra whitespace or Unicode normalization. Only exact surface and predicted type participate; person-title metadata, body/title text part, entity QID, confidence and counts do not.
   */
  id: string;
  /**
   * The surface form of the aggregate entity mention. Previous field name: l_s.
   */
  surface_s: string;
  /**
   * Optional Solr-generated array of surfaces exposed for mention auto-completion. It is absent from submitted disk documents and may be present in indexed readback.
   */
  mentionSuggest?: string[];
  /**
   * Required importer-built Solr suggester payload containing the document id followed by a literal pipe and ner_predicted_type_s: a1_<digest>|type. The importer populates it for every aggregate document, including pressagency and radiostation.
   */
  suggest_payload_s: string;
  /**
   * Predicted ordinary or media-source type of the aggregate entity mention. All five types use this shared schema. Aggregate identity is the exact surface and this type; the same surface classified as org and pressagency produces two aggregates.
   */
  ner_predicted_type_s: "pers" | "loc" | "org" | "pressagency" | "radiostation";
  /**
   * Integer number of accepted body and title occurrences in this exact surface/type aggregate, including linked and NIL occurrences.
   */
  occurrence_count_l: number;
  /**
   * Integer number of distinct content items containing an accepted body or title occurrence of this aggregate. Count each content item once across both text parts.
   */
  content_item_count_l?: number;
  /**
   * Integer number of accepted body and title occurrences in this aggregate linked to an entity QID. It may be zero for an all-NIL aggregate.
   */
  linked_occurrence_count_l?: number;
  /**
   * Integer number of distinct content items containing at least one linked body or title occurrence in this aggregate. Count each content item once across both parts; zero is permitted for an all-NIL aggregate.
   */
  linked_content_item_count_l?: number;
  /**
   * Integer number of accepted body and title occurrences in this aggregate without a linked entity QID. It may be zero for an all-linked aggregate.
   */
  nil_occurrence_count_l?: number;
  /**
   * Optional presence scopes for this aggregate: the union of body/title text parts containing its accepted occurrences, whether linked or NIL. Emit body before title when both are present. Scopes do not split aggregate identity or counts; occurrence counts combine both parts and distinct-content-item counts use their union.
   *
   * @minItems 1
   */
  scopes_ss?: ["body" | "title", ...("body" | "title")[]];
}

/**
 * Start character offset (index) of the TR passage, relative to the content item transcript.
 */
export type StartOffsetOfTRPassage = number;

/**
 * End character offset (index) of the TR passage, relative to the content item transcript.
 */
export type EndOffsetOfTRPassage = number;

/**
 * Unique identifier for the text reuse cluster this passage belongs to
 */
export type ClusterID = string;

/**
 * Number of passages in this text reuse cluster
 */
export type ClusterSize = number;

/**
 * Lexical overlap percentage for the cluster
 */
export type ClusterLexicalOverlap = number;

/**
 * Number of days between the earliest and latest documents in the cluster
 */
export type ClusterDayDelta = number;

/**
 * Text reuse cluster identifier pattern
 */
export type ClusterIdPattern = string;

/**
 * List of cluster IDs that are connected to this cluster
 */
export type ConnectedClusters = ClusterIdPattern[];

/**
 * Count of clusters connected to this cluster
 */
export type NumberOfConnectedClusters = number;

/**
 * Schema for text reuse passage properties within a content item
 */
export interface TextReusePassageSchema {
  beg_offset_i: StartOffsetOfTRPassage;
  end_offset_i: EndOffsetOfTRPassage;
  cluster_id_s: ClusterID;
  cluster_size_l?: ClusterSize;
  cluster_lex_overlap_d?: ClusterLexicalOverlap;
  cluster_day_delta_i?: ClusterDayDelta;
  connected_clusters_ss?: ConnectedClusters;
  n_connected_clusters_i?: NumberOfConnectedClusters;
  [k: string]: unknown;
}