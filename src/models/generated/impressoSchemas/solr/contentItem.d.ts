
/* eslint-disable */
/**
 * This file was automatically generated from the local impresso-schemas
 * submodule by src/scripts/generate-types-from-schemas-repo.js.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
 * and run `npm run generate-types-from-schemas-repo` to regenerate this file.
 */


/**
 * Rights data domain
 */
export type LegalStatus = (PublicDomain | InCopyright) & string;

/**
 * Content in the public domain
 */
export type PublicDomain = "pbl";

/**
 * Rights-protected content
 */
export type InCopyright = "prt";

/**
 * Copyright status of the content.
 */
export type CopyrightStatus = (
  PublicDomain1 | CopyrightUndetermined | NoKnownCopyright | EUOrphanWork | UnknownRightsholders | InCopyright1
) &
  string;

/**
 * Public Domain
 */
export type PublicDomain1 = "pbl";

/**
 * Protected Domain: Copyright undetermined
 */
export type CopyrightUndetermined = "und";

/**
 * Protected Domain: No Known Copyright
 */
export type NoKnownCopyright = "nkn";

/**
 * Protected Domain: In copyright – EU Orphan Work
 */
export type EUOrphanWork = "euo";

/**
 * Protected Domain: In copyright – Unknown rightsholders
 */
export type UnknownRightsholders = "unk";

/**
 * Protected Domain: In copyright
 */
export type InCopyright1 = "in_cpy";

/**
 * Permission level for exploratory use of the content (e.g. browsing, inspection, discovery).
 */
export type PermissionForExploration = (
  | PersonalResearchAndEducationalUse
  | ResearchAndEducationalUse
  | ResearchUse
  | NoUsageRestriction
  | OperationNotPermitted
) &
  string;

/**
 * Use permitted for personal activities, academic research, and educational purposes.
 */
export type PersonalResearchAndEducationalUse = "prs-rsh-edu";

/**
 * Use permitted for academic research and educational purposes.
 */
export type ResearchAndEducationalUse = "rsh-edu";

/**
 * Use permitted strictly for research purposes.
 */
export type ResearchUse = "rsh";

/**
 * No restrictions apply to the use of the content.
 */
export type NoUsageRestriction = "nur";

/**
 * Use of the content is not permitted.
 */
export type OperationNotPermitted = "onp";

/**
 * Permission level for retrieving textual representations of the content.
 */
export type PermissionForTranscriptRetrieval = (
  | PersonalResearchAndEducationalUse
  | ResearchAndEducationalUse
  | ResearchUse
  | NoUsageRestriction
  | OperationNotPermitted
) &
  string;

/**
 * Permission level for retrieving image representations of the content.
 */
export type PermissionForImageRetrieval = (
  | PersonalResearchAndEducationalUse
  | ResearchAndEducationalUse
  | ResearchUse
  | NoUsageRestriction
  | OperationNotPermitted
) &
  string;

/**
 * Access right fields of a media content item.
 */
export interface AccessRightFields {
  rights_data_domain_s: LegalStatus;
  rights_copyright_s: CopyrightStatus;
  rights_perm_use_explore_plain: PermissionForExploration;
  rights_perm_use_get_tr_plain: PermissionForTranscriptRetrieval;
  rights_perm_use_get_img_plain: PermissionForImageRetrieval;
  /**
   * Bookmark limit for exploration.
   */
  rights_bm_explore_l: number;
  /**
   * Bookmark limit for text retrieval.
   */
  rights_bm_get_tr_l: number;
  /**
   * Bookmark limit for image retrieval.
   */
  rights_bm_get_img_l: number;
  [k: string]: unknown;
}

/**
 * Page numbers on which the content item appears.
 *
 * @minItems 1
 */
export type PageNumbers = [number, ...number[]];

/**
 * Identifiers of the pages on which the content item appears.
 *
 * @minItems 1
 */
export type PageIdentifiers = [string, ...string[]];

/**
 * Total number of distinct pages the content item spans.
 */
export type NumberOfPages = number;

/**
 * Indicates whether the content item appears on the front page of the issue.
 */
export type AppearsOnFrontPage = boolean;

/**
 * Whether the content item has reliable coordinate information
 */
export type ConvertedCoordinatesLegacy = boolean;

/**
 * Reading order position of the content item within the issue.
 */
export type ReadingOrder = number;

/**
 * Reusable schema fragment defining content item fields specific to paper-based physical support (facsimile). Intended to be composed with other content item schema parts.
 */
export interface ContentItemPaperSupportSchemaFragment {
  page_nb_is: PageNumbers;
  page_id_ss: PageIdentifiers;
  nb_pages_i: NumberOfPages;
  front_b?: AppearsOnFrontPage;
  cc_b: ConvertedCoordinatesLegacy;
  reading_order_i: ReadingOrder;
  /**
   * Whether the page where the CI originates has been processed with OLR or not.
   */
  olr_b?: boolean;
  /**
   * Region coordinates (rc) in plain text format with page and coordinate information
   */
  rc_plains: string[];
  /**
   * Line boundaries (lb) in plain text format
   */
  lb_plain: string;
  /**
   * Paragraph boundaries (pb) in plain text format
   */
  pb_plain: string;
  /**
   * Region boundaries (rb) in plain text format
   */
  rb_plain: string;
  /**
   * Rebuilt page information.
   */
  pp_plain?: string;
  [k: string]: unknown;
}

/**
 * Textual content and content types fields of media content items in the Impresso project.
 */
export type ContentItemTextContentFields = {
  /**
   * @deprecated
   * Type of document, e.g., page (p) or content item (ci).
   */
  doc_type_s?: "p" | "ci";
  segmentation_level_s: SegmentationLevel;
  item_type_s: ItemType;
  /**
   * Original language of the content item.
   */
  lg_orig_s?: string;
  /**
   * Computed language of the content item.
   */
  lg_s: string;
  /**
   * Token count of the content item (space split).
   */
  content_length_i: number;
  /**
   * Snippet of the content item (first 150 characters).
   */
  snippet_plain: string;
  /**
   * Fallback title field when no language-specific title field is available.
   */
  title_txt?: string;
  /**
   * Fallback content field when no language-specific content field is available.
   */
  content_txt?: string;
  /**
   * String composed of title + year, e.g. 'Fronde-1872' .
   */
  title_year?: string;
  [k: string]: unknown;
} & {
  [k: string]: unknown;
};

/**
 * Level of segmentation applied to the source facsimile from which the content item is derived.
 */
export type SegmentationLevel = (
  | NoSegmentationPageOrBroadcast
  | PhysicalSegmentationLayoutRegions
  | LogicalSegmentationArticlesAndEditorialUnits
  | SemanticSegmentationThematicUnits
) &
  string;

/**
 * No optical layout segmentation applied; the content item corresponds to a full page or broadcast unit.
 */
export type NoSegmentationPageOrBroadcast = "none";

/**
 * Physical layout segmentation into regions such as images, columns, or paragraphs.
 */
export type PhysicalSegmentationLayoutRegions = "physical";

/**
 * Logical segmentation into articles and other editorial or structural units.
 */
export type LogicalSegmentationArticlesAndEditorialUnits = "logical";

/**
 * Semantic segmentation into thematically or conceptually coherent units.
 */
export type SemanticSegmentationThematicUnits = "semantic";

/**
 * Type of content item.
 */
export type ItemType = (
  | Page
  | Article
  | Advertisement
  | Image
  | Table
  | Obituary
  | Weather
  | Chronicle
  | RadioBulletin
  | RadioBroadcastEpisode
  | NoTypeProvided
  | Discussion
  | Entertainment
  | Chapter
) &
  string;

/**
 * Full page of content, in the case of OCR-only data. Later becomes 'None' or 'No-type'.
 */
export type Page = "page";

/**
 * Textual unit(s) corresponding to a journalistic editorial unit.
 */
export type Article = "ar" | "article";

/**
 * Commercial or classified advertising content.
 */
export type Advertisement = "ad";

/**
 * Standalone visual content.
 */
export type Image = "img" | "image";

/**
 * Tabular content presenting structured data or listings.
 */
export type Table = "tb" | "table";

/**
 * Notice reporting a death, often including biographical information.
 */
export type Obituary = "ob" | "death_notice";

/**
 * Weather report or meteorological information.
 */
export type Weather = "w" | "weather";

/**
 * Broadcast chronicle reporting events in a factual or narrative form.
 */
export type Chronicle = "ch" | "chronicle";

/**
 * Content item originating from a radio bulletin.
 */
export type RadioBulletin = "radio_bulletin" | "rb";

/**
 * An individual episode or segment of a radio broadcast.
 */
export type RadioBroadcastEpisode = "rbe" | "radio_broadcast_episode";

/**
 * Content item with no specific type provided (short version).
 */
export type NoTypeProvided = "no-type";

/**
 * Radio Broadcast discussion or talk show content item.
 */
export type Discussion = "dsc" | "discussion";

/**
 * Radio Broadcast entertainment content item.
 */
export type Entertainment = "ent" | "entertainment";

/**
 * TO BE REFINED.
 */
export type Chapter = "chapter";

/**
 * Semantic enrichments fields of media content items in the Impresso project.
 */
export type SemanticEnrichmentsFieldsPartOfComposedSchema = EntityAndMentionEnrichmentFields & {
  /**
   * OCR quality assessment score between 0.00 and 1.00, or null if unavailable.
   */
  ocrqa_f: OCRQAScore | Unavailable;
  /**
   * Topics assigned to the content item.
   */
  topics_dpfs?: string;
  /**
   * TR Cluster IDs assigned to the content item.
   */
  cluster_id_ss?: string[];
  /**
   * Content item embedding as a vector of floats.
   */
  gte_multi_v768?: number[];
  [k: string]: unknown;
};

/**
 * Aggregate mention IDs for person surface/type groups present in this content item, including groups containing NIL occurrences.
 */
export type AggregateMentionIds = string[];

/**
 * Existing payload serialization of person mention surfaces and NER confidence values on the 0-1 scale.
 */
export type ConfidencePayload = string[];

/**
 * Entity QIDs with counts of linked person occurrences in this content item; NIL occurrences contribute no entry.
 */
export type EntityPayload = string[];

/**
 * Aggregate mention IDs for location surface/type groups present in this content item, including groups containing NIL occurrences.
 */
export type AggregateMentionIds1 = string[];

/**
 * Existing payload serialization of location mention surfaces and NER confidence values on the 0-1 scale.
 */
export type ConfidencePayload1 = string[];

/**
 * Entity QIDs with counts of linked location occurrences in this content item; NIL occurrences contribute no entry.
 */
export type EntityPayload1 = string[];

/**
 * Aggregate mention IDs for organisation surface/type groups present in this content item, including groups containing NIL occurrences.
 */
export type AggregateMentionIds2 = string[];

/**
 * Existing payload serialization of organisation mention surfaces and NER confidence values on the 0-1 scale.
 */
export type ConfidencePayload2 = string[];

/**
 * Entity QIDs with counts of linked organisation occurrences in this content item; NIL occurrences contribute no entry.
 */
export type EntityPayload2 = string[];

/**
 * Aggregate mention IDs for press-agency surface/type groups present in this content item, including groups containing NIL occurrences.
 */
export type AggregateMentionIds3 = string[];

/**
 * Existing payload serialization of press-agency mention surfaces and NER confidence values on the 0-1 scale.
 */
export type ConfidencePayload3 = string[];

/**
 * Entity QIDs with counts of linked press-agency occurrences in this content item; NIL occurrences contribute no entry.
 */
export type EntityPayload3 = string[];

/**
 * Aggregate mention IDs for radio-station surface/type groups present in this content item, including groups containing NIL occurrences.
 */
export type AggregateMentionIds4 = string[];

/**
 * Existing payload serialization of radio-station mention surfaces and NER confidence values on the 0-1 scale.
 */
export type ConfidencePayload4 = string[];

/**
 * Entity QIDs with counts of linked radio-station occurrences in this content item; NIL occurrences contribute no entry.
 */
export type EntityPayload4 = string[];

export type OCRQAScore = number;

export type Unavailable = null;

/**
 * Entity and aggregate-mention fields embedded in main content-item documents. Occurrence lists describe accepted mentions in the article body; title mentions are not included in this contract.
 */
export interface EntityAndMentionEnrichmentFields {
  /**
   * JSON-encoded ordered array of [start, length] pairs for accepted person mentions in the article body.
   */
  pers_mention_offsets_json_plain?: string;
  /**
   * JSON-encoded ordered array of exact person mention surfaces corresponding positionally to the offsets (former pers_mentions).
   */
  pers_mention_surfaces_json_plain?: string;
  /**
   * JSON-encoded ordered array of linked entity QIDs or null for each corresponding person mention.
   */
  pers_mention_qids_json_plain?: string;
  pers_aggregate_mention_ids_ss?: AggregateMentionIds;
  pers_mention_ner_conf_dpfs?: ConfidencePayload;
  pers_entity_ids_dpfs?: EntityPayload;
  /**
   * JSON-encoded ordered array of [start, length] pairs for accepted location mentions in the article body.
   */
  loc_mention_offsets_json_plain?: string;
  /**
   * JSON-encoded ordered array of exact location mention surfaces corresponding positionally to the offsets (former loc_mentions).
   */
  loc_mention_surfaces_json_plain?: string;
  /**
   * JSON-encoded ordered array of linked entity QIDs or null for each corresponding location mention.
   */
  loc_mention_qids_json_plain?: string;
  loc_aggregate_mention_ids_ss?: AggregateMentionIds1;
  loc_mention_ner_conf_dpfs?: ConfidencePayload1;
  loc_entity_ids_dpfs?: EntityPayload1;
  /**
   * JSON-encoded ordered array of [start, length] pairs for accepted organisation mentions in the article body.
   */
  org_mention_offsets_json_plain?: string;
  /**
   * JSON-encoded ordered array of exact organisation mention surfaces corresponding positionally to the offsets (former org_mentions).
   */
  org_mention_surfaces_json_plain?: string;
  /**
   * JSON-encoded ordered array of linked entity QIDs or null for each corresponding organisation mention.
   */
  org_mention_qids_json_plain?: string;
  org_aggregate_mention_ids_ss?: AggregateMentionIds2;
  org_mention_ner_conf_dpfs?: ConfidencePayload2;
  org_entity_ids_dpfs?: EntityPayload2;
  /**
   * JSON-encoded ordered array of [start, length] pairs for accepted press-agency mentions in the article body.
   */
  pressagency_mention_offsets_json_plain?: string;
  /**
   * JSON-encoded ordered array of exact press-agency mention surfaces corresponding positionally to the offsets (former nag_mentions).
   */
  pressagency_mention_surfaces_json_plain?: string;
  /**
   * JSON-encoded ordered array of linked entity QIDs or null for each corresponding press-agency mention.
   */
  pressagency_mention_qids_json_plain?: string;
  pressagency_aggregate_mention_ids_ss?: AggregateMentionIds3;
  pressagency_mention_ner_conf_dpfs?: ConfidencePayload3;
  pressagency_entity_ids_dpfs?: EntityPayload3;
  /**
   * JSON-encoded ordered array of [start, length] pairs for accepted radio-station mentions in the article body.
   */
  radiostation_mention_offsets_json_plain?: string;
  /**
   * JSON-encoded ordered array of exact radio-station mention surfaces corresponding positionally to the offsets.
   */
  radiostation_mention_surfaces_json_plain?: string;
  /**
   * JSON-encoded ordered array of linked entity QIDs or null for each corresponding radio-station mention.
   */
  radiostation_mention_qids_json_plain?: string;
  radiostation_aggregate_mention_ids_ss?: AggregateMentionIds4;
  radiostation_mention_ner_conf_dpfs?: ConfidencePayload4;
  radiostation_entity_ids_dpfs?: EntityPayload4;
  [k: string]: unknown;
}

/**
 * Audio related information for audio content items.
 */
export interface ContentItemAudioPartSchema {
  /**
   * Start time of media in HH:MM:SS format (relative to the day of broadcast). Applies only to audio radio broadcasts.
   */
  meta_start_time_s?: string;
  /**
   * Duration of the radio broadcast in HH:MM:SS format (relative to the start of the broadcast on the given broadcast day).  Applies only to audio radio broadcasts."
   */
  meta_duration_s?: string;
  /**
   * Array of record identifiers for radio broadcast segments
   */
  record_id_ss?: string[];
  /**
   * Array of record numbers corresponding to radio broadcast segments
   */
  record_nb_is?: number[];
  /**
   * Total number of records/segments in the radio broadcast
   */
  nb_record_i?: number;
  /**
   * Audio time stamps of the audio record. Serialized JSON of radio broadcast segments as defined in https://github.com/impresso/impresso-schemas/blob/radio-broadcast-schemas/json/rebuilt/audio_record_contentitem.schema.json.
   */
  rreb_plain?: string;
  /**
   * Utterance breaks ends offsets in content item transcript. Serialized array of integers, see 'ub' in https://github.com/impresso/impresso-schemas/blob/radio-broadcast-schemas/json/rebuilt/audio_record_contentitem.schema.json.
   */
  ub_plain?: string;
  [k: string]: unknown;
}

/**
 * Contextual metadata field of a media content item.
 */
export interface ContextualMetadataFields {
  /**
   * Country code of the publication.
   */
  meta_country_code_s?: string;
  /**
   * Province code of the publication.
   */
  meta_province_code_s?: string;
  /**
   * Periodicity of the publication, e.g., daily, weekly.
   */
  meta_periodicity_s?: string;
  /**
   * Topics associated with the publication.
   */
  meta_topics_s?: string;
  /**
   * Political orientation of the publication.
   */
  meta_polorient_s?: string;
  /**
   * Partner ID associated with the publication.
   */
  meta_partnerid_s?: string;
  [k: string]: unknown;
}

/**
 * Unique identifier for the content item
 */
export type ContentItemID = string;

/**
 * Media title alias. Will soon be deprecated in favor of meta_media_s.
 */
export type MediaTitleAlias = string;

/**
 * Radio program name the broadcast belongs to. Sourced from 'radio_program' key in additional_metadata. Provider: RTS.
 */
export type RadioProgram = string;

/**
 * Radio channel the broadcast was aired on. Sourced from 'radio_channel' key in additional_metadata. Provider: RTS.
 */
export type RadioChannel = string;

/**
 * Core fields of media content items in the Impresso project.
 */
export interface ContentItemCoreFieldsPartOfComposedSchema {
  id: ContentItemID;
  /**
   * @deprecated
   * Media title alias. Will soon be deprecated in favor of meta_media_s.
   */
  meta_journal_s: string;
  meta_media_alias_s: MediaTitleAlias;
  /**
   * Year of publication/broadcast
   */
  meta_year_i: number;
  /**
   * Month of publication/broadcast
   */
  meta_month_i: number;
  /**
   * Year-month in YYYY-MM format
   */
  meta_yearmonth_s?: string;
  /**
   * Day of publication/broadcast
   */
  meta_day_i: number;
  /**
   * Edition identifier
   */
  meta_ed_s?: string;
  /**
   * Full date and time in ISO 8601 format
   */
  meta_date_dt: string;
  /**
   * Issue identifier
   */
  meta_issue_id_s?: string;
  /**
   * Type of the media source. Should be a value from impresso-essentials.utils SourceType enum.
   */
  meta_source_type_s:
    "newspaper" | "radio_broadcast" | "radio_magazine" | "radio_schedule" | "monograph" | "encyclopedia";
  /**
   * Medium of the source (audio for audio radio broadcasts, print for newspapers, typescript for digitised radio bulletin typescripts).
   */
  meta_source_medium_s: "audio" | "print" | "typescript";
  meta_radio_program_s?: RadioProgram;
  meta_radio_channel_s?: RadioChannel;
  [k: string]: unknown;
}

/**
 * Top-level composed schema for image (illustration) content items. Aggregates modular content-item schema fragments specific to visual content.
 */
export type ImageContentItemComposedSchema = ContentItemCoreFieldsPartOfComposedSchema &
  ContextualMetadataFields &
  AccessRightFields &
  ImageDocumentFieldsFragment &
  ImageSemanticEnrichmentFieldsFragment;

/**
 * Identifier of the related content item (CI), as identified by the OLR process.
 */
export type LinkedContentItemID = string;

/**
 * Original caption associated with the image.
 */
export type ImageCaption = string;

/**
 * Type of content item.
 */
export type ItemType1 = "image";

/**
 * Bounding box of the image on the page, expressed as [x, y, width, height] in pixel coordinates.
 *
 * @minItems 4
 * @maxItems 4
 */
export type ImageCoordinates = [unknown, unknown, unknown, unknown];

/**
 * IIIF Image1 API URL for the image.
 */
export type IIIFImageURL = string;

/**
 * Original caption, in the field for the language of the caption.
 *
 * This interface was referenced by `ImageDocumentFieldsFragment`'s JSON-Schema definition
 * via the `patternProperty` "^caption_txt_[a-z]{2}$".
 */
export type ImageCaptionLanguageAnalysed = string;

/**
 * Automatically generated descriptive keywords associated with the image.
 *
 * @minItems 1
 */
export type DescriptiveKeywords = [string, ...string[]];

/**
 * Classification value from Level 0 of the Image1 Typology V2 taxonomy. Classifies whether the detected page region is a visual content or a non-visual region incorrectly identified as an image during layout recognition.
 */
export type ImageTypologyV2Level0ClassVisualContent = (Image1 | NotAnImage | Undetermined) &
  (((Image1 | NotAnImage | Undetermined) & string) | (null & (Image1 | NotAnImage | Undetermined)));

/**
 * A visual content intended to be classified.
 */
export type Image1 = "image";

/**
 * A non-visual page region, such as enlarged lettering, incorrectly identified as an image.
 */
export type NotAnImage = "not_image";

/**
 * The classification could not be determined, or does not apply at this level.
 */
export type Undetermined = null;

/**
 * Classification value from Level 1 of the Image1 Typology V2 taxonomy. Classifies the technique of the original visual content, distinguishing photographs from all other techniques.
 */
export type ImageTypologyV2Level1ClassTechnique = (Photograph | NotAPhotograph | Undetermined1) &
  (((Photograph | NotAPhotograph | Undetermined1) & string) | (null & (Photograph | NotAPhotograph | Undetermined1)));

/**
 * A visual content reproduced from a photograph.
 */
export type Photograph = "photograph";

/**
 * A visual content reproduced using a technique other than photography.
 */
export type NotAPhotograph = "not_photograph";

/**
 * The classification could not be determined, or does not apply at this level.
 */
export type Undetermined1 = null;

/**
 * Classification value from Level 2 of the Image1 Typology V2 taxonomy. Classifies the broad communicative purpose for which the visual content was included in the newspaper, independently of its depicted subject.
 */
export type ImageTypologyV2Level2ClassCommunicationGoal = (
  Decorative | InformativeOrIllustrative | Advertising | Entertainment1 | Undetermined2
) &
  (
    | ((Decorative | InformativeOrIllustrative | Advertising | Entertainment1 | Undetermined2) & string)
    | (null & (Decorative | InformativeOrIllustrative | Advertising | Entertainment1 | Undetermined2))
  );

/**
 * A visual element included primarily for aesthetic purposes rather than to convey direct information.
 */
export type Decorative = "decorative";

/**
 * A visual content intended to convey factual information, clarify, illustrate, or support an article.
 */
export type InformativeOrIllustrative = "informative_or_illustrative";

/**
 * A visual content promoting a product, service, business, event, place, or other concept.
 */
export type Advertising = "advertising";

/**
 * A visual content intended to amuse, engage, or provide leisure to readers.
 */
export type Entertainment1 = "entertainment";

/**
 * The classification could not be determined, or does not apply at this level.
 */
export type Undetermined2 = null;

/**
 * Classification value from Level 3 of the Image1 Typology V2 taxonomy. Classifies the form, structure, and representational characteristics of the visual content.
 */
export type ImageTypologyV2Level3ClassVisualContentType = (
  | "caricature_humoristic_drawing"
  | "comic_strip"
  | "illustrated_story"
  | "game"
  | "graph"
  | "technical_drawing"
  | "human_rep_fashion_visual"
  | "human_rep_portrait"
  | "human_rep_scene"
  | "scenery_landscape"
  | "map_geological"
  | "map_geopolitical"
  | "map_physical_or_roadmap"
  | "map_plan"
  | "map_weather"
  | "weather_infographic"
  | "non_figurative_visual_content"
  | "object"
  | "ornament_illustrated_title"
  | "other"
  | Undetermined3
) &
  (
    | ((
        | "caricature_humoristic_drawing"
        | "comic_strip"
        | "illustrated_story"
        | "game"
        | "graph"
        | "technical_drawing"
        | "human_rep_fashion_visual"
        | "human_rep_portrait"
        | "human_rep_scene"
        | "scenery_landscape"
        | "map_geological"
        | "map_geopolitical"
        | "map_physical_or_roadmap"
        | "map_plan"
        | "map_weather"
        | "weather_infographic"
        | "non_figurative_visual_content"
        | "object"
        | "ornament_illustrated_title"
        | "other"
        | Undetermined3
      ) &
        string)
    | (null &
        (
          | "caricature_humoristic_drawing"
          | "comic_strip"
          | "illustrated_story"
          | "game"
          | "graph"
          | "technical_drawing"
          | "human_rep_fashion_visual"
          | "human_rep_portrait"
          | "human_rep_scene"
          | "scenery_landscape"
          | "map_geological"
          | "map_geopolitical"
          | "map_physical_or_roadmap"
          | "map_plan"
          | "map_weather"
          | "weather_infographic"
          | "non_figurative_visual_content"
          | "object"
          | "ornament_illustrated_title"
          | "other"
          | Undetermined3
        ))
  );

/**
 * The classification could not be determined, or does not apply at this level.
 */
export type Undetermined3 = null;

/**
 * Dense vector representation of the image computed using the DINOv2 model. The vector has a fixed dimensionality of 1024.
 *
 * @minItems 1024
 * @maxItems 1024
 */
export type DINOv2ImageEmbedding1024D = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number
];

/**
 * Dense vector representation of the image computed using the OpenCLIP model. The vector has a fixed dimensionality of 768.
 *
 * @minItems 768
 * @maxItems 768
 */
export type OpenCLIPImageEmbedding768D = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number
];

/**
 * Solr fields describing an image content item and its placement in a newspaper issue. This fragment is composed with core, access-rights, and image semantic-enrichment fields in the complete image Solr document.
 */
export interface ImageDocumentFieldsFragment {
  linked_ci_s?: LinkedContentItemID;
  reading_order_i: ReadingOrder;
  page_nb_is: PageNumbers;
  front_b: AppearsOnFrontPage;
  cc_b: ConvertedCoordinatesLegacy;
  caption_txt?: ImageCaption;
  item_type_s: ItemType1;
  coords_is: ImageCoordinates;
  iiif_url_s: IIIFImageURL;
  page_id_ss: PageIdentifiers;
  /**
   * Original language of the content item.
   */
  lg_orig_s?: string;
  [k: string]:
    | ImageCaptionLanguageAnalysed
    | ReadingOrder
    | PageNumbers
    | AppearsOnFrontPage
    | ItemType1
    | ImageCoordinates
    | PageIdentifiers
    | undefined;
}

/**
 * Solr fields containing semantic-enrichment results for an image content item, including classification labels, descriptive keywords, and image embeddings. This fragment is composed into the complete image Solr document.
 */
export interface ImageSemanticEnrichmentFieldsFragment {
  descriptive_keywords_ss?: DescriptiveKeywords;
  type_l0_tp: ImageTypologyV2Level0ClassVisualContent;
  type_l1_tp: ImageTypologyV2Level1ClassTechnique;
  type_l2_tp: ImageTypologyV2Level2ClassCommunicationGoal;
  type_l3_tp: ImageTypologyV2Level3ClassVisualContentType;
  dinov2_emb_v1024?: DINOv2ImageEmbedding1024D;
  openclip_emb_v768?: OpenCLIPImageEmbedding768D;
  [k: string]: unknown;
}

/**
 * Top-level composed schema for audio content items. Aggregates modular content-item schema fragments specific to broadcasts.
 */
export type AudioContentItemComposedSchema = ContentItemCoreFieldsPartOfComposedSchema &
  ContextualMetadataFields &
  ProviderContextualMetadataFields &
  AccessRightFields &
  ContentItemTextContentFields1 &
  SemanticEnrichmentsFieldsPartOfComposedSchema &
  ContentItemAudioPartSchema;

/**
 * Production type of the broadcast (e.g. 'Production propre'). Sourced from 'production_type' key in additional_metadata. Provider: RTS.
 */
export type ProductionType = string;

/**
 * Place where the broadcast was recorded. Sourced from 'recording_place' key in additional_metadata. Provider: RTS.
 */
export type RecordingPlace = string;

/**
 * Whether the broadcast was live. Derived from 'live' key in additional_metadata. Provider: RTS.
 */
export type LiveBroadcast = boolean;

/**
 * Geographical descriptors associated with the broadcast content (e.g. countries, cities). Sourced from 'geographical_descriptors' key in additional_metadata. Provider: RTS.
 */
export type GeographicalDescriptors = string[];

/**
 * Thematic descriptors categorising the broadcast content (e.g. topics, themes). Sourced from 'thematical_descriptors' key in additional_metadata. Provider: RTS.
 */
export type ThematicDescriptors = string[];

/**
 * Participants in the broadcast, including role and affiliation where available. Sourced from 'participants' key in additional_metadata. Provider: RTS.
 */
export type Participants = string[];

/**
 * Textual content and content types fields of media content items in the Impresso project.
 */
export type ContentItemTextContentFields1 = {
  [k: string]: unknown;
} & {
  /**
   * @deprecated
   * Type of document, e.g., page (p) or content item (ci).
   */
  doc_type_s?: "p" | "ci";
  segmentation_level_s: SegmentationLevel;
  item_type_s: ItemType;
  /**
   * Original language of the content item.
   */
  lg_orig_s?: string;
  /**
   * Computed language of the content item.
   */
  lg_s: string;
  /**
   * Token count of the content item (space split).
   */
  content_length_i: number;
  /**
   * Snippet of the content item (first 150 characters).
   */
  snippet_plain: string;
  /**
   * Fallback title field when no language-specific title field is available.
   */
  title_txt?: string;
  /**
   * Fallback content field when no language-specific content field is available.
   */
  content_txt?: string;
  /**
   * String composed of title + year, e.g. 'Fronde-1872' .
   */
  title_year?: string;
  [k: string]: unknown;
};

/**
 * Provider-supplied contextual metadata fields for content items. These fields are passed through verbatim from the data provider's 'additional_metadata' key-value pairs and are NOT harmonised or curated by Impresso. Field availability depends on the provider. The 'meta_prv_' prefix signals that no cross-provider consistency is guaranteed.
 */
export interface ProviderContextualMetadataFields {
  meta_prv_production_type_s?: ProductionType;
  meta_prv_recording_place_s?: RecordingPlace;
  meta_prv_live_b?: LiveBroadcast;
  meta_prv_geo_descriptors_ss?: GeographicalDescriptors;
  meta_prv_thematic_descriptors_ss?: ThematicDescriptors;
  meta_prv_participants_ss?: Participants;
  [k: string]: unknown;
}

/**
 * Top-level composed schema for content items originating from printed or typescripted paper sources. This schema aggregates multiple modular content-item schema fragments.
 */
export type PaperContentItemComposedSchema = ContentItemCoreFieldsPartOfComposedSchema &
  ContextualMetadataFields &
  AccessRightFields &
  ContentItemTextContentFields2 &
  SemanticEnrichmentsFieldsPartOfComposedSchema &
  ContentItemPaperSupportSchemaFragment;

/**
 * Textual content and content types fields of media content items in the Impresso project.
 */
export type ContentItemTextContentFields2 = {
  [k: string]: unknown;
} & {
  /**
   * @deprecated
   * Type of document, e.g., page (p) or content item (ci).
   */
  doc_type_s?: "p" | "ci";
  segmentation_level_s: SegmentationLevel;
  item_type_s: ItemType;
  /**
   * Original language of the content item.
   */
  lg_orig_s?: string;
  /**
   * Computed language of the content item.
   */
  lg_s: string;
  /**
   * Token count of the content item (space split).
   */
  content_length_i: number;
  /**
   * Snippet of the content item (first 150 characters).
   */
  snippet_plain: string;
  /**
   * Fallback title field when no language-specific title field is available.
   */
  title_txt?: string;
  /**
   * Fallback content field when no language-specific content field is available.
   */
  content_txt?: string;
  /**
   * String composed of title + year, e.g. 'Fronde-1872' .
   */
  title_year?: string;
  [k: string]: unknown;
};