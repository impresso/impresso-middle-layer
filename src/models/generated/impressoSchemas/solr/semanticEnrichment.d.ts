
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