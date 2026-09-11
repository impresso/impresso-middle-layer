
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
  | PublicDomain1
  | CopyrightUndetermined
  | NoKnownCopyright
  | EUOrphanWork
  | UnknownRightsholders
  | InCopyright1
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
  | Article
  | Advertisement
  | Image
  | Table
  | Obituary
  | Weather
  | Chronicle
  | RadioBroadcast
  | RadioBroadcastEpisode
  | NoTypeProvided
  | Discussion
  | Entretien
) &
  string;

/**
 * Editorial article forming a coherent textual unit.
 */
export type Article = "ar";

/**
 * Commercial or classified advertising content.
 */
export type Advertisement = "ad";

/**
 * Standalone visual content such as a photograph, illustration, or graphic.
 */
export type Image = "img";

/**
 * Tabular content presenting structured data or listings.
 */
export type Table = "tb";

/**
 * Notice reporting a death, often including biographical information.
 */
export type Obituary = "ob";

/**
 * Weather report or meteorological information.
 */
export type Weather = "w";

/**
 * Broadcast chronicle reporting events in a factual or narrative form.
 */
export type Chronicle = "ch";

/**
 * Content item originating from a radio broadcast.
 */
export type RadioBroadcast = "rb";

/**
 * An individual episode or segment of a radio broadcast.
 */
export type RadioBroadcastEpisode = "rbe";

/**
 * Content item with no specific type provided.
 */
export type NoTypeProvided = "no-type";

/**
 * Radio Broadcast discussion or talk show content item.
 */
export type Discussion = "dsc";

/**
 * Radio Broadcast interview content item.
 */
export type Entretien = "ent";

export type OCRQAScore = number;

export type Unavailable = null;

/**
 * Semantic enrichments fields of media content items in the Impresso project.
 */
export interface SemanticEnrichmentsFieldsPartOfComposedSchema {
  /**
   * OCR quality assessment score between 0.00 and 1.00, or null if unavailable.
   */
  ocrqa_f: OCRQAScore | Unavailable;
  /**
   * List of mentions from news agencies.
   */
  nag_mentions?: string | null;
  /**
   * Offsets for news agency mentions in plain text.
   */
  nag_offset_plain?: string;
  /**
   * Confidence scores for news agency mentions.
   */
  nag_mention_conf_dpfs?: string | null;
  /**
   * Entities of type news agency.
   */
  nag_entities_dpfs?: string | null;
  /**
   * List of detected person mention surface strings extracted from the content (may contain duplicates).
   */
  pers_mentions?: string | null;
  /**
   * List of person mention confidence annotations; each entry is typically a string combining mention and confidence in the pipeline format (for example: 'Mention text|95.2').
   */
  pers_mention_conf_dpfs?: string | null;
  /**
   * Serialized person entity annotations (for example qid/identifier or JSON fragment) produced by the entity recognition pipeline.
   */
  pers_entities_dpfs?: string | null;
  /**
   * Confidence scores for person entities.
   */
  pers_entities_conf_dpfs?: string | null;
  /**
   * List of detected location mention surface strings extracted from the content.
   */
  loc_mentions?: string | null;
  /**
   * List of location mention confidence annotations; entries typically encode mention and confidence (e.g. 'Location|87.3').
   */
  loc_mention_conf_dpfs?: string | null;
  /**
   * Serialized location entity annotations (identifier or JSON) assigned to the detected location mentions.
   */
  loc_entities_dpfs?: string | null;
  /**
   * Confidence scores for location entities.
   */
  loc_entities_conf_dpfs?: string | null;
  /**
   * List of detected organization mention surface strings extracted from the content.
   */
  org_mentions?: string | null;
  /**
   * List of organization mention confidence annotations; strings typically combine mention and confidence (e.g. 'Org name|75.4').
   */
  org_mention_conf_dpfs?: string | null;
  /**
   * Serialized organization entity annotations (identifier or JSON) assigned to the detected organization mentions.
   */
  org_entities_dpfs?: string | null;
  /**
   * Confidence scores for organization entities.
   */
  org_entities_conf_dpfs?: string | null;
  /**
   * Offsets for named entity mentions in plain text.
   */
  nem_offset_plain?: string;
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
    | "newspaper"
    | "radio_broadcast"
    | "radio_magazine"
    | "radio_schedule"
    | "monograph"
    | "encyclopedia";
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
export type ImageContentItemComposedSchema = ContentItemCoreFieldsPartOfComposedSchema & AccessRightFields & Image2;

/**
 * Identifier of the related content item (CI), as identified by the OLR process.
 */
export type LinkedContentItemID = string;

/**
 * Original caption associated with the image.
 */
export type ImageCaption = string;

/**
 * Automatically generated descriptive keywords associated with the image.
 *
 * @minItems 1
 */
export type DescriptiveKeywords = [string, ...string[]];

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
 * IIIF Image2 API URL for the image.
 */
export type IIIFImageURL = string;

/**
 * Whether the content is an image or not.
 */
export type VisualContent = (Image1 | NotAnImage) & string;

export type Image1 = "image";

export type NotAnImage = "not_image";

/**
 * Determines if the image is a photograph.
 */
export type Technique = (Photograph | NotAPhotograph) & string;

export type Photograph = "photograph";

export type NotAPhotograph = "not_photograph";

/**
 * Purpose or communicative function of the image.
 */
export type CommunicationGoal = (Decorative | InformativeOrIllustrative | Advertising | Entertainment) & string;

export type Decorative = "decorative";

export type InformativeOrIllustrative = "informative_or_illustrative";

export type Advertising = "advertising";

export type Entertainment = "entertainment";

/**
 * Classification of the visual content.
 */
export type VisualContentType = (
  | CaricatureOrHumoristicDrawing
  | ComicStrip
  | IllustratedStory
  | Game
  | Graph
  | TechnicalDrawing
  | HumanRepresentationFashionVisual
  | HumanRepresentationPortrait
  | HumanRepresentationScene
  | SceneryOrLandscape
  | MapGeological
  | MapGeopolitical
  | MapPhysicalOrRoadmap
  | MapPlan
  | MapWeather
  | WeatherInfographic
  | NonFigurativeVisualContent
  | Object
  | OrnamentOrIllustratedTitle
  | Other
) &
  string;

export type CaricatureOrHumoristicDrawing = "caricature_humoristic_drawing";

export type ComicStrip = "comic_strip";

export type IllustratedStory = "illustrated_story";

export type Game = "game";

export type Graph = "graph";

export type TechnicalDrawing = "technical_drawing";

export type HumanRepresentationFashionVisual = "human_rep_fashion_visual";

export type HumanRepresentationPortrait = "human_rep_portrait";

export type HumanRepresentationScene = "human_rep_scene";

export type SceneryOrLandscape = "scenery_landscape";

export type MapGeological = "map_geological";

export type MapGeopolitical = "map_geopolitical";

export type MapPhysicalOrRoadmap = "map_physical_or_roadmap";

export type MapPlan = "map_plan";

export type MapWeather = "map_weather";

export type WeatherInfographic = "weather_infographic";

export type NonFigurativeVisualContent = "non_figurative_visual_content";

export type Object = "object";

export type OrnamentOrIllustratedTitle = "ornament_illustrated_title";

export type Other = "other";

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
 * Image2 Solr document in Impresso v2
 */
export interface Image2 {
  linked_ci_s?: LinkedContentItemID;
  reading_order_i: ReadingOrder;
  page_nb_is: PageNumbers;
  front_b: AppearsOnFrontPage;
  cc_b: ConvertedCoordinatesLegacy;
  caption_txt?: ImageCaption;
  descriptive_keywords_ss?: DescriptiveKeywords;
  item_type_s: ItemType1;
  coords_is: ImageCoordinates;
  iiif_url_s: IIIFImageURL;
  type_l0_tp?: VisualContent;
  type_l1_tp?: Technique;
  type_l2_tp?: CommunicationGoal;
  type_l3_tp?: VisualContentType;
  dinov2_emb_v1024: DINOv2ImageEmbedding1024D;
  openclip_emb_v768: OpenCLIPImageEmbedding768D;
  [k: string]: unknown;
}