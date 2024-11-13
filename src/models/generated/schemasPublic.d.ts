
/* eslint-disable */
/**
 * This file was automatically generated by json-schema-to-typescript.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
 * and run json-schema-to-typescript to regenerate this file.
 */


/**
 * Collection details.
 */
export interface Collection {
  /**
   * Unique identifier of the collection.
   */
  uid: string;
  /**
   * Title of the collection.
   */
  title: string;
  /**
   * Description of the collection.
   */
  description: string;
  /**
   * Access level of the collection.
   */
  accessLevel: "public" | "private";
  /**
   * Creation date of the collection.
   */
  createdAt: string;
  /**
   * Last update date of the collection.
   */
  updatedAt: string;
  /**
   * Total number of items in the collection.
   */
  totalItems: number;
}


/**
 * A journal/magazine content item (article, advertisement, etc.)
 */
export interface ContentItem {
  /**
   * The unique identifier of the content item.
   */
  uid: string;
  /**
   * The type of the content item, as present in the OLR provided by the data provider. All content items are not characterised by the same set of types.
   */
  type: string;
  /**
   * The title of the content item.
   */
  title: string;
  /**
   * Transcript of the content item.
   */
  transcript: string;
  /**
   * Locations mentioned in the content item.
   */
  locations: EntityMention[];
  /**
   * Persions mentioned in the content item.
   */
  persons: EntityMention[];
  /**
   * Topics mentioned in the content item.
   */
  topics: TopicMention[];
  /**
   * The length of the transcript in characters.
   */
  transcriptLength: number;
  /**
   * Total number of pages the item covers.
   */
  totalPages: number;
  /**
   * ISO 639-1 language code of the content item.
   */
  languageCode?: string;
  /**
   * Whether the content item is on the front page of the publication.
   */
  isOnFrontPage: boolean;
  /**
   * The publication date of the content item.
   */
  publicationDate: string;
  /**
   * ISO 3166-1 alpha-2 country code of the content item.
   */
  countryCode?: string;
  /**
   * The code of the data provider.
   */
  dataProviderCode?: string;
  /**
   * Code of the newspaper or the other media the content item belongs to.
   */
  mediaCode?: string;
  /**
   * The type of the media the content item belongs to.
   */
  mediaType?: "newspaper";
}
/**
 * An entity (location, persion) mention.
 */
export interface EntityMention {
  /**
   * Unique identifier of the entity
   */
  uid: string;
  /**
   * Relevance of the entity in the document
   */
  relevance: number;
}
/**
 * Topic presence in a content item.
 */
export interface TopicMention {
  /**
   * Unique identifier of the topic.
   */
  uid: string;
  /**
   * Relevance of the topic in the content item.
   */
  relevance: number;
}


/**
 * An entity: location or person.
 */
export interface EntityDetails {
  /**
   * Unique identifier of the entity
   */
  uid?: string;
  /**
   * Entity label
   */
  label?: string;
  type?: "person" | "location";
  /**
   * Wikidata identifier of the entity.
   */
  wikidataId?: string;
  /**
   * Total number of mentions of the entity.
   */
  totalMentions?: number;
  /**
   * Total number of content items the entity is mentioned in.
   */
  totalContentItems?: number;
}


/**
 * An entity (location, persion) mention.
 */
export interface EntityMention {
  /**
   * Unique identifier of the entity
   */
  uid: string;
  /**
   * Relevance of the entity in the document
   */
  relevance: number;
}


/**
 * Response for GET /text-reuse-clusters
 */
export interface FindTextReuseClustersResponse {
  clusters: unknown[];
  info: {
    [k: string]: unknown;
  };
}


/**
 * A newspaper
 */
export interface Newspaper {
  /**
   * The unique identifier of the newspaper.
   */
  uid: string;
  /**
   * The title of the newspaper.
   */
  title: string;
  /**
   * The year of the first available article in the newspaper.
   */
  startYear?: number;
  /**
   * The year of the last available article in the newspaper.
   */
  endYear?: number;
  /**
   * ISO 639-1 codes of languages used in the newspaper.
   */
  languageCodes: string[];
  /**
   * Total number of articles in the newspaper.
   */
  totalArticles: number;
  /**
   * Total number of issues in the newspaper.
   */
  totalIssues: number;
  /**
   * Total number of pages in the newspaper.
   */
  totalPages: number;
}


/**
 * An object containing search results for a facet
 */
export interface SearchFacet {
  /**
   * The type of facet
   */
  type: string;
  /**
   * The number of buckets in the facet
   */
  numBuckets: number;
  buckets: SearchFacetBucket[] | SearchFacetRangeBucket[];
}
/**
 * Facet bucket
 */
export interface SearchFacetBucket {
  /**
   * Number of items in the bucket
   */
  count: number;
  /**
   * Value that represents the bucket.
   */
  value: string | number;
  /**
   * Label of the value, if relevant.
   */
  label?: string;
}
/**
 * Facet bucket
 */
export interface SearchFacetRangeBucket {
  /**
   * Number of items in the bucket
   */
  count: number;
  /**
   * Value of the 'type' element
   */
  val: number;
  /**
   * Lower bound of the range
   */
  lower?: number;
  /**
   * Lower bound of the range
   */
  upper?: number;
}


/**
 * Facet bucket
 */
export interface SearchFacetBucket {
  /**
   * Number of items in the bucket
   */
  count: number;
  /**
   * Value that represents the bucket.
   */
  value: string | number;
  /**
   * Label of the value, if relevant.
   */
  label?: string;
}


/**
 * Facet bucket
 */
export interface SearchFacetRangeBucket {
  /**
   * Number of items in the bucket
   */
  count: number;
  /**
   * Value of the 'type' element
   */
  val: number;
  /**
   * Lower bound of the range
   */
  lower?: number;
  /**
   * Lower bound of the range
   */
  upper?: number;
}


/**
 * Text reuse cluster details.
 */
export interface TextReuseCluster {
  /**
   * Unique ID of the text reuse cluster.
   */
  uid: string;
  /**
   * Overlap in percents between the passages in the cluster.
   */
  lexicalOverlap: number;
  /**
   * Number of passages in the cluster.
   */
  clusterSize: number;
  /**
   * Sample of a text from one of the passages in the cluster.
   */
  textSample: string;
  /**
   * Time coverage of the cluster.
   */
  timeCoverage: {
    /**
     * Publication date of the earliest content item in the cluster.
     */
    startDate: string;
    /**
     * Publication date of the latest content item in the cluster.
     */
    endDate: string;
  };
}


/**
 * Represents a passage of text that was identified as a part of a text reuse cluster
 */
export interface TextReusePassage {
  /**
   * Unique ID of the text reuse passage.
   */
  uid: string;
  /**
   * Textual content of the passage.
   */
  content: string;
  /**
   * ID of the content item that the text reuse passage belongs to.
   */
  contentItemId: string;
  /**
   * Start and end offsets of the passage in the content item.
   */
  offset: {
    /**
     * Start offset of the passage in the content item.
     */
    start: number;
    /**
     * End offset of the passage in the content item.
     */
    end: number;
    [k: string]: unknown;
  };
}


/**
 * Topic presence in a content item.
 */
export interface TopicMention {
  /**
   * Unique identifier of the topic.
   */
  uid: string;
  /**
   * Relevance of the topic in the content item.
   */
  relevance: number;
}


/**
 * Details of the current version of the API and details of its aspects.
 */
export interface VersionDetails {
  /**
   * Version of the API.
   */
  version?: string;
}
