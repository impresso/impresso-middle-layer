
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
 * Schema for entity documents produced by the v3 importers and according to the new representation  (Impresso Project). The entity document is a Solr document containing frequency and identifier fields, and it is the canonical representation of an entity in the Impresso Project. [CODEX please complete]
 */
export interface EntitySolrDocumentV3 {
  /**
   * Unique Wikidata identifier of the entity.
   */
  id: string;
  /**
   * TODO
   */
  default_label_s: string;
  /**
   * TODO
   */
  label_fr_s: string;
  /**
   * TODO
   */
  label_de_s: string;
  /**
   * TODO
   */
  label_en_s: string;
  /**
   * TODO
   */
  label_other_s: string;
  /**
   * Optional Solr suggester field documenting the labels exposed for entity auto-completion. It is populated by Solr configuration and may be absent from submitted documents.
   */
  entitySuggest?: string[];
  /**
   * One NER type selected by the importer as the most frequent predicted type among accepted occurrences linked to this QID. Tie resolution is importer-defined; this field records one selected type and does not use a mixed value.
   */
  ner_entity_type_s: "pers" | "loc" | "org" | "pressagency" | "radiostation";
  /**
   * Number of distinct content items containing at least one accepted occurrence linked to this QID. Former field name was article_fq_f.
   */
  content_item_count_l: number;
  /**
   * Number of accepted mention occurrences linked to this QID across the indexed population. Former field name was mention_fq_f.
   */
  mention_count_l?: number;
  /**
   * number of accepted mention occurrences linked to this QID across the indexed population, with NER type `pers`
   */
  ner_type_pers_count_l?: number;
  /**
   * number of accepted mention occurrences linked to this QID across the indexed population, with NER type `loc`
   */
  ner_type_loc_count_l?: number;
  /**
   * number of accepted mention occurrences linked to this QID across the indexed population, with NER type `org`
   */
  ner_type_org_count_l?: number;
  /**
   * number of accepted mention occurrences linked to this QID across the indexed population, with NER type `pressagency`
   */
  ner_type_pressagency_count_l?: number;
  /**
   * number of accepted mention occurrences linked to this QID across the indexed population, with NER type `radiostation`
   */
  ner_type_radiostation_count_l?: number;
}

/**
 * Schema for aggregate entity mention documents produced by the v2 importers and according to the new representation (Impresso Project). A mention document aggregates every occurrence sharing an exact surface and type. [CODEX please complete]
 */
export interface AggregateEntityMentionSolrDocumentV3ClassicEntityTypes {
  /**
   * Deterministic aggregate identifier: 'a1_' ('a' for aggregate and '1' for the version of the id pattern) followed by the unpadded base64url encoding of the first 16 bytes of the SHA-256 digest of the compact JSON encoding of [surface, predicted type]. The identifier is based only on the exact aggregate surface and predicted type; title, entity QID, confidence and counts do not participate.
   */
  id: string;
  /**
   * The surface form of the aggregate entity mention. Previous field name: l_s.
   */
  surface_s: string;
  /**
   * The predicted NER type of the aggregate entity mention. The aggregate identity is the exact surface and this type. Media-source types are validated by the dedicated media-source schema.
   */
  ner_predicted_type_s: "pers" | "loc" | "org";
  /**
   * Number of accepted occurrences in this exact surface/type aggregate, including linked and NIL occurrences (as float in Solr).
   */
  occurrence_count_l: number;
  /**
   * Number of distinct content items containing this exact surface/type aggregate (as float in Solr).
   */
  content_item_count_l?: number;
  /**
   * Number of occurrences in this aggregate linked to an entity QID(as float in Solr). It may be zero for an all-NIL aggregate.
   */
  linked_occurrence_count_l?: number;
  /**
   * Number of distinct content items containing at least one linked occurrence in this aggregate (as float in Solr). It may be zero for an all-NIL aggregate.
   */
  linked_content_item_count_l?: number;
  /**
   * Number of occurrences in this aggregate with no linked entity QID (as float in Solr). It may be zero for an all-linked aggregate.
   */
  nil_occurrence_count_l?: number;
}

/**
 * Schema for aggregate mention documents in the 08_impresso_mentions collection for press agencies and radio stations. Each document groups accepted occurrences sharing an exact surface and media-source type.
 */
export interface MediaSourceAggregateMentionSolrDocumentV1 {
  /**
   * Deterministic aggregate identifier: 'a1_' followed by the unpadded base64url encoding of the first 16 bytes of the SHA-256 digest of the compact JSON encoding of [surface, predicted type]. The identifier is based only on the exact aggregate surface and predicted type.
   */
  id: string;
  /**
   * The surface form of the aggregate entity mention. Previous field name: l_s.
   */
  surface_s: string;
  /**
   * Predicted media-source type of the aggregate mention.
   */
  ner_predicted_type_s: "pressagency" | "radiostation";
  /**
   * Number of accepted occurrences in this exact surface/type aggregate, including linked and NIL occurrences.
   */
  occurrence_count_l: number;
  /**
   * Number of distinct content items containing this exact surface/type aggregate.
   */
  content_item_count_l?: number;
  /**
   * Number of occurrences in this aggregate linked to an entity QID. It may be zero for an all-NIL aggregate.
   */
  linked_occurrence_count_l?: number;
  /**
   * Number of distinct content items containing at least one linked occurrence in this aggregate. It may be zero for an all-NIL aggregate.
   */
  linked_content_item_count_l?: number;
  /**
   * Number of occurrences in this aggregate with no linked entity QID. It may be zero for an all-linked aggregate.
   */
  nil_occurrence_count_l?: number;
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