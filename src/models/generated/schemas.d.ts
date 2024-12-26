
/* eslint-disable */
/**
 * This file was automatically generated by json-schema-to-typescript.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
 * and run json-schema-to-typescript to regenerate this file.
 */


export interface BaseFind {
  /**
   * The number of items returned in this response
   */
  limit: number;
  /**
   * Starting index of the items subset returned in this response
   */
  offset: number;
  /**
   * The total number of items matching the query
   */
  total: number;
  /**
   * Additional information about the response.
   */
  info?: {
    [k: string]: unknown;
  };
  data: unknown[];
}


export type UniqueIdentifierForTheUser = string;
export type UniqueUsernameForTheUserForOtherHumans = string;

export interface BaseUser {
  uid: UniqueIdentifierForTheUser;
  username: UniqueUsernameForTheUserForOtherHumans;
  [k: string]: unknown;
}


export type StatusOfTheCollection = string;
export type NumberOfItemsInTheCollection = number | string;
export type UniqueIdentifierForTheUser = string;
export type UniqueUsernameForTheUserForOtherHumans = string;

/**
 * Collectable item group object
 */
export interface CollectableItemGroup {
  /**
   * The id of the collectable item group
   */
  itemId?: string;
  /**
   * Content type of the collectable item group: (A)rticle, (E)ntities, (P)ages, (I)ssues
   */
  contentType?: "A" | "E" | "P" | "I";
  /**
   * Ids of the collections
   */
  collectionIds?: string[];
  /**
   * Search queries
   */
  searchQueries?: string[];
  /**
   * Collection objects
   */
  collections?: Collection[];
  /**
   * The latest date added to the collectable item group
   */
  latestDateAdded?: string;
  [k: string]: unknown;
}
/**
 * Description of the collection object (Collection class)
 */
export interface Collection {
  uid: string;
  name: string;
  description: string;
  status: StatusOfTheCollection;
  creationDate: string;
  lastModifiedDate: string;
  countItems: NumberOfItemsInTheCollection;
  creator: BaseUser;
  labels?: string[];
}
export interface BaseUser {
  uid: UniqueIdentifierForTheUser;
  username: UniqueUsernameForTheUserForOtherHumans;
  [k: string]: unknown;
}


export type StatusOfTheCollection = string;
export type NumberOfItemsInTheCollection = number | string;
export type UniqueIdentifierForTheUser = string;
export type UniqueUsernameForTheUserForOtherHumans = string;

/**
 * Description of the collection object (Collection class)
 */
export interface Collection {
  uid: string;
  name: string;
  description: string;
  status: StatusOfTheCollection;
  creationDate: string;
  lastModifiedDate: string;
  countItems: NumberOfItemsInTheCollection;
  creator: BaseUser;
  labels?: string[];
}
export interface BaseUser {
  uid: UniqueIdentifierForTheUser;
  username: UniqueUsernameForTheUserForOtherHumans;
  [k: string]: unknown;
}


export type StatusOfTheCollection = string;
export type NumberOfItemsInTheCollection = number | string;
export type UniqueIdentifierForTheUser = string;
export type UniqueUsernameForTheUserForOtherHumans = string;

/**
 * A journal/magazine content item (article, advertisement, etc.)
 */
export interface ContentItem {
  /**
   * The unique identifier of the content item
   */
  uid: string;
  /**
   * The type of the content item. NOTE: may be empty.
   */
  type: string;
  /**
   * The title of the content item
   */
  title: string;
  /**
   * The size of the content item in characters
   */
  size: number;
  /**
   * The number of pages in this content item
   */
  nbPages: number;
  pages: Page[];
  /**
   * TODO
   */
  isCC: boolean;
  /**
   * The excerpt of the content item
   */
  excerpt: string;
  locations?: Entity[];
  persons?: Entity[];
  /**
   * The language code of the content item
   */
  language?: string;
  issue?: NewspaperIssue;
  matches?: ContentItemMatch[];
  regions?: ContentItemRegion[];
  regionBreaks?: number[];
  contentLineBreaks?: number[];
  /**
   * TODO
   */
  labels: "article"[];
  accessRight: "na" | "OpenPrivate" | "Closed" | "OpenPublic";
  /**
   * TODO
   */
  isFront?: boolean;
  date?: string | null;
  /**
   * The year of the content item
   */
  year: number;
  /**
   * The country code of the content item
   */
  country?: string;
  tags?: string[];
  collections?: string[] | Collection[];
  newspaper?: Newspaper;
  dataProvider?: string | null;
  topics?: ContentItemTopic[];
  /**
   * The content of the content item
   */
  content?: string;
  mentions?: {
    person?: [number, number][];
    location?: [number, number][];
  }[];
  /**
   * TODO
   */
  v?: string;
  /**
   * Access rights bitmap for the UI
   */
  bitmapExplore?: number;
  /**
   * Access rights bitmap for downloading the transcript
   */
  bitmapGetTranscript?: number;
  /**
   * Access rights bitmap for getting images
   */
  bitmapGetImages?: number;
}
/**
 * A page of an article
 */
export interface Page {
  /**
   * The unique identifier of the page
   */
  uid: string;
  /**
   * The number of the page
   */
  num: number;
  /**
   * Reference to the article
   */
  issueUid: string;
  /**
   * Unique ID of the newspaper
   */
  newspaperUid: string;
  /**
   * The IIF image file name of the page
   */
  iiif: string;
  /**
   * The IIF image thumbnail file name of the page
   */
  iiifThumbnail: string;
  /**
   * The access rights code
   */
  accessRights: string;
  /**
   * Page labels
   */
  labels: string[];
  /**
   * Whether the page has coordinates
   */
  hasCoords: boolean;
  /**
   * Whether the page has errors
   */
  hasErrors: boolean;
  /**
   * Regions of the page
   */
  regions: {
    [k: string]: unknown;
  }[];
  /**
   * Whether the page image has been obfuscated because the user is not authorised to access it
   */
  obfuscated?: boolean;
  /**
   * The IIIF fragment of the page, image file name
   */
  iiifFragment?: string;
}
/**
 * An entity like location, person, etc
 */
export interface Entity {
  /**
   * Unique identifier of the entity
   */
  uid: string;
  /**
   * Relevance of the entity in the document
   */
  relevance: number;
}
export interface NewspaperIssue {
  /**
   * The unique identifier of the issue
   */
  uid: string;
  /**
   * TODO
   */
  cover: string;
  /**
   * The labels of the issue
   */
  labels: string[];
  /**
   * TODO
   */
  fresh: boolean;
  /**
   * TODO: list available options
   */
  accessRights: string;
  /**
   * The date of the issue
   */
  date?: string;
  /**
   * The year of the issue
   */
  year?: string;
}
/**
 * TODO
 */
export interface ContentItemMatch {
  /**
   * TODO
   */
  fragment: string;
  /**
   * TODO
   */
  coords?: number[];
  /**
   * TODO
   */
  pageUid?: string;
  /**
   * TODO
   */
  iiif?: string;
}
/**
 * TODO
 */
export interface ContentItemRegion {
  pageUid: string;
  coords: number[];
  /**
   * TODO
   */
  isEmpty: boolean;
  /**
   * IIIF fragment URL
   */
  iiifFragment?: string;
  /**
   * TODO
   */
  g?: string[];
}
/**
 * Description of the collection object (Collection class)
 */
export interface Collection {
  uid: string;
  name: string;
  description: string;
  status: StatusOfTheCollection;
  creationDate: string;
  lastModifiedDate: string;
  countItems: NumberOfItemsInTheCollection;
  creator: BaseUser;
  labels?: string[];
}
export interface BaseUser {
  uid: UniqueIdentifierForTheUser;
  username: UniqueUsernameForTheUserForOtherHumans;
  [k: string]: unknown;
}
/**
 * A newspaper
 */
export interface Newspaper {
  /**
   * The unique identifier of the newspaper
   */
  uid: string;
  /**
   * The acronym of the newspaper
   */
  acronym: string;
  /**
   * The labels of the newspaper
   */
  labels: string[];
  /**
   * Language codes of the languages used in the newspaper
   */
  languages: string[];
  /**
   * TODO
   */
  properties?: NewspaperProperty[];
  /**
   * TODO
   */
  included: boolean;
  /**
   * Title of the newspaper
   */
  name: string;
  endYear: number | null;
  startYear: number | null;
  firstIssue?: NewspaperIssue;
  lastIssue?: NewspaperIssue;
  /**
   * The number of articles in the newspaper
   */
  countArticles: number;
  /**
   * The number of issues in the newspaper
   */
  countIssues: number;
  /**
   * The number of pages in the newspaper
   */
  countPages: number;
  /**
   * TODO
   */
  fetched?: boolean;
  /**
   * The number of years of the newspaper available
   */
  deltaYear: number;
}
export interface NewspaperProperty {
  /**
   * The name of the property
   */
  name: string;
  /**
   * The value of the property
   */
  value: string;
  /**
   * The label of the property
   */
  label: string;
  /**
   * Whether the value is a URL
   */
  isUrl?: boolean;
  [k: string]: unknown;
}
/**
 * TODO
 */
export interface ContentItemTopic {
  topic?: Topic;
  /**
   * TODO
   */
  relevance: number;
  /**
   * TODO
   */
  topicUid?: string;
}
/**
 * A topic (TODO)
 */
export interface Topic {
  /**
   * The unique identifier of the topic
   */
  uid: string;
  /**
   * The language code of the topic
   */
  language: string;
  /**
   * TODO
   */
  community?: string;
  /**
   * TODO
   */
  pagerank?: number;
  /**
   * TODO
   */
  degree?: number;
  /**
   * TODO
   */
  x?: number;
  /**
   * TODO
   */
  y?: number;
  relatedTopics?: {
    /**
     * The unique identifier of the related topic
     */
    uid: string;
    /**
     * TODO
     */
    w: number;
    /**
     * TODO
     */
    avg?: number;
  }[];
  /**
   * TODO
   */
  countItems?: number;
  /**
   * TODO
   */
  excerpt?: TopicWord[];
  /**
   * TODO
   */
  words?: TopicWord[];
  /**
   * ID of the model used to generate the topic
   */
  model?: string;
}
/**
 * TODO
 */
export interface TopicWord {
  /**
   * Word
   */
  w: string;
  /**
   * TODO
   */
  p: number;
  /**
   * TODO
   */
  h?: string[];
}


/**
 * TODO
 */
export interface ContentItemMatch {
  /**
   * TODO
   */
  fragment: string;
  /**
   * TODO
   */
  coords?: number[];
  /**
   * TODO
   */
  pageUid?: string;
  /**
   * TODO
   */
  iiif?: string;
}


/**
 * TODO
 */
export interface ContentItemRegion {
  pageUid: string;
  coords: number[];
  /**
   * TODO
   */
  isEmpty: boolean;
  /**
   * IIIF fragment URL
   */
  iiifFragment?: string;
  /**
   * TODO
   */
  g?: string[];
}


/**
 * TODO
 */
export interface ContentItemTopic {
  topic?: Topic;
  /**
   * TODO
   */
  relevance: number;
  /**
   * TODO
   */
  topicUid?: string;
}
/**
 * A topic (TODO)
 */
export interface Topic {
  /**
   * The unique identifier of the topic
   */
  uid: string;
  /**
   * The language code of the topic
   */
  language: string;
  /**
   * TODO
   */
  community?: string;
  /**
   * TODO
   */
  pagerank?: number;
  /**
   * TODO
   */
  degree?: number;
  /**
   * TODO
   */
  x?: number;
  /**
   * TODO
   */
  y?: number;
  relatedTopics?: {
    /**
     * The unique identifier of the related topic
     */
    uid: string;
    /**
     * TODO
     */
    w: number;
    /**
     * TODO
     */
    avg?: number;
  }[];
  /**
   * TODO
   */
  countItems?: number;
  /**
   * TODO
   */
  excerpt?: TopicWord[];
  /**
   * TODO
   */
  words?: TopicWord[];
  /**
   * ID of the model used to generate the topic
   */
  model?: string;
}
/**
 * TODO
 */
export interface TopicWord {
  /**
   * Word
   */
  w: string;
  /**
   * TODO
   */
  p: number;
  /**
   * TODO
   */
  h?: string[];
}


/**
 * An entity like location, person, etc
 */
export interface Entity {
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
 * An entity like location, person, etc
 */
export interface EntityDetails {
  /**
   * Unique identifier of the entity
   */
  uid: string;
  /**
   * Entity name
   */
  name: string;
  type: "person" | "location";
  /**
   * TODO
   */
  countItems: number;
  /**
   * Number of mentions of this entity in articles
   */
  countMentions: number;
  /**
   * ID of the entity in wikidata
   */
  wikidataId?: string;
  wikidata?: WikidataEntityDetailsTODOAddPersonLocationSpecificFields;
}
/**
 * Details of a wikidata entity
 */
export interface WikidataEntityDetailsTODOAddPersonLocationSpecificFields {
  id: string;
  type: string;
  /**
   * Labels of the entity. Key is the language code.
   */
  labels: {
    [k: string]: string;
  };
  /**
   * Labels of the entity. Key is the language code.
   */
  descriptions: {
    [k: string]: string;
  };
  images: {
    value: string;
    rank: string;
    datatype: string;
    [k: string]: unknown;
  }[];
  [k: string]: unknown;
}


/**
 * ID of the text reuse passage
 */
export type PassageID = string;

/**
 * Response for GET /text-reuse-clusters
 */
export interface FindTextReuseClustersResponse {
  clusters: TextReuseClusterCompound[];
  info: {
    [k: string]: unknown;
  };
}
/**
 * Text reuse cluster with details and a sample
 */
export interface TextReuseClusterCompound {
  cluster?: TextReuseCluster;
  textSample: string;
  details?: TextReuseClusterDetails;
  /**
   * Access rights bitmap for the UI
   */
  bitmapExplore?: number;
  /**
   * Access rights bitmap for downloading the transcript
   */
  bitmapGetTranscript?: number;
}
/**
 * Represents a cluster of text reuse passages
 */
export interface TextReuseCluster {
  id: PassageID;
  /**
   * Percentage of overlap between passages in the cluster
   */
  lexicalOverlap?: number;
  /**
   * Number of passages in cluster
   */
  clusterSize?: number;
  /**
   * Number of connected clusters
   */
  connectedClustersCount?: number;
  /**
   * Time window covered by documents in the cluster
   */
  timeCoverage?: {
    from?: string;
    to?: string;
  };
}
/**
 * Extra details of the cluster
 */
export interface TextReuseClusterDetails {
  facets: {
    /**
     * Facet type
     */
    type?: string;
    /**
     * Number of buckets
     */
    numBuckets?: number;
    buckets?: {
      [k: string]: unknown;
    }[];
  }[];
  /**
   * Resolution for the 'date' facet
   */
  resolution?: "year" | "month" | "day";
}


/**
 * A media source is what a content item belongs to. This can be a newspaper, a TV or a radio station, etc.
 */
export interface MediaSource {
  /**
   * The unique identifier of the media source.
   */
  uid: string;
  /**
   * The type of the media source.
   */
  type: "newspaper";
  /**
   * A display name of the media source.
   */
  name: string;
  /**
   * ISO 639-2 language codes this media source has content in.
   */
  languageCodes: string[];
  /**
   * The range of dates this media source has content items for. This represents the earliest and the latest dates of the contet items.
   *
   * @minItems 2
   * @maxItems 2
   */
  datesRange?: [string, string];
  totals: {
    /**
     * The number of articles in the media source.
     */
    articles?: number;
    /**
     * The number of issues in the media source.
     */
    issues?: number;
    /**
     * The number of pages in the media source.
     */
    pages?: number;
  };
  properties: {
    /**
     * The unique identifier of the property.
     */
    id?: string;
    /**
     * The name of the property.
     */
    label?: string;
    /**
     * The value of the property.
     */
    value: string;
  }[];
}


/**
 * A newspaper
 */
export interface Newspaper {
  /**
   * The unique identifier of the newspaper
   */
  uid: string;
  /**
   * The acronym of the newspaper
   */
  acronym: string;
  /**
   * The labels of the newspaper
   */
  labels: string[];
  /**
   * Language codes of the languages used in the newspaper
   */
  languages: string[];
  /**
   * TODO
   */
  properties?: NewspaperProperty[];
  /**
   * TODO
   */
  included: boolean;
  /**
   * Title of the newspaper
   */
  name: string;
  endYear: number | null;
  startYear: number | null;
  firstIssue?: NewspaperIssue;
  lastIssue?: NewspaperIssue;
  /**
   * The number of articles in the newspaper
   */
  countArticles: number;
  /**
   * The number of issues in the newspaper
   */
  countIssues: number;
  /**
   * The number of pages in the newspaper
   */
  countPages: number;
  /**
   * TODO
   */
  fetched?: boolean;
  /**
   * The number of years of the newspaper available
   */
  deltaYear: number;
}
export interface NewspaperProperty {
  /**
   * The name of the property
   */
  name: string;
  /**
   * The value of the property
   */
  value: string;
  /**
   * The label of the property
   */
  label: string;
  /**
   * Whether the value is a URL
   */
  isUrl?: boolean;
  [k: string]: unknown;
}
export interface NewspaperIssue {
  /**
   * The unique identifier of the issue
   */
  uid: string;
  /**
   * TODO
   */
  cover: string;
  /**
   * The labels of the issue
   */
  labels: string[];
  /**
   * TODO
   */
  fresh: boolean;
  /**
   * TODO: list available options
   */
  accessRights: string;
  /**
   * The date of the issue
   */
  date?: string;
  /**
   * The year of the issue
   */
  year?: string;
}


export interface NewspaperIssue {
  /**
   * The unique identifier of the issue
   */
  uid: string;
  /**
   * TODO
   */
  cover: string;
  /**
   * The labels of the issue
   */
  labels: string[];
  /**
   * TODO
   */
  fresh: boolean;
  /**
   * TODO: list available options
   */
  accessRights: string;
  /**
   * The date of the issue
   */
  date?: string;
  /**
   * The year of the issue
   */
  year?: string;
}


export interface NewspaperProperty {
  /**
   * The name of the property
   */
  name: string;
  /**
   * The value of the property
   */
  value: string;
  /**
   * The label of the property
   */
  label: string;
  /**
   * Whether the value is a URL
   */
  isUrl?: boolean;
  [k: string]: unknown;
}


/**
 * A page of an article
 */
export interface Page {
  /**
   * The unique identifier of the page
   */
  uid: string;
  /**
   * The number of the page
   */
  num: number;
  /**
   * Reference to the article
   */
  issueUid: string;
  /**
   * Unique ID of the newspaper
   */
  newspaperUid: string;
  /**
   * The IIF image file name of the page
   */
  iiif: string;
  /**
   * The IIF image thumbnail file name of the page
   */
  iiifThumbnail: string;
  /**
   * The access rights code
   */
  accessRights: string;
  /**
   * Page labels
   */
  labels: string[];
  /**
   * Whether the page has coordinates
   */
  hasCoords: boolean;
  /**
   * Whether the page has errors
   */
  hasErrors: boolean;
  /**
   * Regions of the page
   */
  regions: {
    [k: string]: unknown;
  }[];
  /**
   * Whether the page image has been obfuscated because the user is not authorised to access it
   */
  obfuscated?: boolean;
  /**
   * The IIIF fragment of the page, image file name
   */
  iiifFragment?: string;
}


export type StatusOfTheCollection = string;
export type NumberOfItemsInTheCollection = number | string;
export type UniqueIdentifierForTheUser = string;
export type UniqueUsernameForTheUserForOtherHumans = string;

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
  /**
   * TODO
   */
  min?: {
    [k: string]: unknown;
  };
  /**
   * TODO
   */
  max?: {
    [k: string]: unknown;
  };
  /**
   * TODO
   */
  gap?: {
    [k: string]: unknown;
  };
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
   * Value of the 'type' element
   */
  val: string;
  /**
   * UID of the 'type' element. Same as 'val'
   */
  uid?: string;
  /**
   * The item in the bucket. Particular objct schema depends on the facet type
   */
  item?: Newspaper | Collection | Entity | Topic | Year;
}
/**
 * A newspaper
 */
export interface Newspaper {
  /**
   * The unique identifier of the newspaper
   */
  uid: string;
  /**
   * The acronym of the newspaper
   */
  acronym: string;
  /**
   * The labels of the newspaper
   */
  labels: string[];
  /**
   * Language codes of the languages used in the newspaper
   */
  languages: string[];
  /**
   * TODO
   */
  properties?: NewspaperProperty[];
  /**
   * TODO
   */
  included: boolean;
  /**
   * Title of the newspaper
   */
  name: string;
  endYear: number | null;
  startYear: number | null;
  firstIssue?: NewspaperIssue;
  lastIssue?: NewspaperIssue;
  /**
   * The number of articles in the newspaper
   */
  countArticles: number;
  /**
   * The number of issues in the newspaper
   */
  countIssues: number;
  /**
   * The number of pages in the newspaper
   */
  countPages: number;
  /**
   * TODO
   */
  fetched?: boolean;
  /**
   * The number of years of the newspaper available
   */
  deltaYear: number;
}
export interface NewspaperProperty {
  /**
   * The name of the property
   */
  name: string;
  /**
   * The value of the property
   */
  value: string;
  /**
   * The label of the property
   */
  label: string;
  /**
   * Whether the value is a URL
   */
  isUrl?: boolean;
  [k: string]: unknown;
}
export interface NewspaperIssue {
  /**
   * The unique identifier of the issue
   */
  uid: string;
  /**
   * TODO
   */
  cover: string;
  /**
   * The labels of the issue
   */
  labels: string[];
  /**
   * TODO
   */
  fresh: boolean;
  /**
   * TODO: list available options
   */
  accessRights: string;
  /**
   * The date of the issue
   */
  date?: string;
  /**
   * The year of the issue
   */
  year?: string;
}
/**
 * Description of the collection object (Collection class)
 */
export interface Collection {
  uid: string;
  name: string;
  description: string;
  status: StatusOfTheCollection;
  creationDate: string;
  lastModifiedDate: string;
  countItems: NumberOfItemsInTheCollection;
  creator: BaseUser;
  labels?: string[];
}
export interface BaseUser {
  uid: UniqueIdentifierForTheUser;
  username: UniqueUsernameForTheUserForOtherHumans;
  [k: string]: unknown;
}
/**
 * An entity like location, person, etc
 */
export interface Entity {
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
 * A topic (TODO)
 */
export interface Topic {
  /**
   * The unique identifier of the topic
   */
  uid: string;
  /**
   * The language code of the topic
   */
  language: string;
  /**
   * TODO
   */
  community?: string;
  /**
   * TODO
   */
  pagerank?: number;
  /**
   * TODO
   */
  degree?: number;
  /**
   * TODO
   */
  x?: number;
  /**
   * TODO
   */
  y?: number;
  relatedTopics?: {
    /**
     * The unique identifier of the related topic
     */
    uid: string;
    /**
     * TODO
     */
    w: number;
    /**
     * TODO
     */
    avg?: number;
  }[];
  /**
   * TODO
   */
  countItems?: number;
  /**
   * TODO
   */
  excerpt?: TopicWord[];
  /**
   * TODO
   */
  words?: TopicWord[];
  /**
   * ID of the model used to generate the topic
   */
  model?: string;
}
/**
 * TODO
 */
export interface TopicWord {
  /**
   * Word
   */
  w: string;
  /**
   * TODO
   */
  p: number;
  /**
   * TODO
   */
  h?: string[];
}
/**
 * A year (TODO)
 */
export interface Year {
  /**
   * Numeric representation of the year
   */
  uid?: number;
  values?: YearWeights;
  refs?: YearWeights;
}
/**
 * Total items counts within a year
 */
export interface YearWeights {
  /**
   * Number of content items
   */
  c?: number;
  /**
   * Number of articles
   */
  a?: number;
  /**
   * Number of pages
   */
  p?: number;
  /**
   * Number of issues
   */
  i?: number;
  /**
   * Number of images (with or without vectors)
   */
  m?: number;
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


export type StatusOfTheCollection = string;
export type NumberOfItemsInTheCollection = number | string;
export type UniqueIdentifierForTheUser = string;
export type UniqueUsernameForTheUserForOtherHumans = string;

/**
 * Facet bucket
 */
export interface SearchFacetBucket {
  /**
   * Number of items in the bucket
   */
  count: number;
  /**
   * Value of the 'type' element
   */
  val: string;
  /**
   * UID of the 'type' element. Same as 'val'
   */
  uid?: string;
  /**
   * The item in the bucket. Particular objct schema depends on the facet type
   */
  item?: Newspaper | Collection | Entity | Topic | Year;
}
/**
 * A newspaper
 */
export interface Newspaper {
  /**
   * The unique identifier of the newspaper
   */
  uid: string;
  /**
   * The acronym of the newspaper
   */
  acronym: string;
  /**
   * The labels of the newspaper
   */
  labels: string[];
  /**
   * Language codes of the languages used in the newspaper
   */
  languages: string[];
  /**
   * TODO
   */
  properties?: NewspaperProperty[];
  /**
   * TODO
   */
  included: boolean;
  /**
   * Title of the newspaper
   */
  name: string;
  endYear: number | null;
  startYear: number | null;
  firstIssue?: NewspaperIssue;
  lastIssue?: NewspaperIssue;
  /**
   * The number of articles in the newspaper
   */
  countArticles: number;
  /**
   * The number of issues in the newspaper
   */
  countIssues: number;
  /**
   * The number of pages in the newspaper
   */
  countPages: number;
  /**
   * TODO
   */
  fetched?: boolean;
  /**
   * The number of years of the newspaper available
   */
  deltaYear: number;
}
export interface NewspaperProperty {
  /**
   * The name of the property
   */
  name: string;
  /**
   * The value of the property
   */
  value: string;
  /**
   * The label of the property
   */
  label: string;
  /**
   * Whether the value is a URL
   */
  isUrl?: boolean;
  [k: string]: unknown;
}
export interface NewspaperIssue {
  /**
   * The unique identifier of the issue
   */
  uid: string;
  /**
   * TODO
   */
  cover: string;
  /**
   * The labels of the issue
   */
  labels: string[];
  /**
   * TODO
   */
  fresh: boolean;
  /**
   * TODO: list available options
   */
  accessRights: string;
  /**
   * The date of the issue
   */
  date?: string;
  /**
   * The year of the issue
   */
  year?: string;
}
/**
 * Description of the collection object (Collection class)
 */
export interface Collection {
  uid: string;
  name: string;
  description: string;
  status: StatusOfTheCollection;
  creationDate: string;
  lastModifiedDate: string;
  countItems: NumberOfItemsInTheCollection;
  creator: BaseUser;
  labels?: string[];
}
export interface BaseUser {
  uid: UniqueIdentifierForTheUser;
  username: UniqueUsernameForTheUserForOtherHumans;
  [k: string]: unknown;
}
/**
 * An entity like location, person, etc
 */
export interface Entity {
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
 * A topic (TODO)
 */
export interface Topic {
  /**
   * The unique identifier of the topic
   */
  uid: string;
  /**
   * The language code of the topic
   */
  language: string;
  /**
   * TODO
   */
  community?: string;
  /**
   * TODO
   */
  pagerank?: number;
  /**
   * TODO
   */
  degree?: number;
  /**
   * TODO
   */
  x?: number;
  /**
   * TODO
   */
  y?: number;
  relatedTopics?: {
    /**
     * The unique identifier of the related topic
     */
    uid: string;
    /**
     * TODO
     */
    w: number;
    /**
     * TODO
     */
    avg?: number;
  }[];
  /**
   * TODO
   */
  countItems?: number;
  /**
   * TODO
   */
  excerpt?: TopicWord[];
  /**
   * TODO
   */
  words?: TopicWord[];
  /**
   * ID of the model used to generate the topic
   */
  model?: string;
}
/**
 * TODO
 */
export interface TopicWord {
  /**
   * Word
   */
  w: string;
  /**
   * TODO
   */
  p: number;
  /**
   * TODO
   */
  h?: string[];
}
/**
 * A year (TODO)
 */
export interface Year {
  /**
   * Numeric representation of the year
   */
  uid?: number;
  values?: YearWeights;
  refs?: YearWeights;
}
/**
 * Total items counts within a year
 */
export interface YearWeights {
  /**
   * Number of content items
   */
  c?: number;
  /**
   * Number of articles
   */
  a?: number;
  /**
   * Number of pages
   */
  p?: number;
  /**
   * Number of issues
   */
  i?: number;
  /**
   * Number of images (with or without vectors)
   */
  m?: number;
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
 * ID of the text reuse passage
 */
export type PassageID = string;

/**
 * Represents a cluster of text reuse passages
 */
export interface TextReuseCluster {
  id: PassageID;
  /**
   * Percentage of overlap between passages in the cluster
   */
  lexicalOverlap?: number;
  /**
   * Number of passages in cluster
   */
  clusterSize?: number;
  /**
   * Number of connected clusters
   */
  connectedClustersCount?: number;
  /**
   * Time window covered by documents in the cluster
   */
  timeCoverage?: {
    from?: string;
    to?: string;
  };
}


/**
 * ID of the text reuse passage
 */
export type PassageID = string;

/**
 * Text reuse cluster with details and a sample
 */
export interface TextReuseClusterCompound {
  cluster?: TextReuseCluster;
  textSample: string;
  details?: TextReuseClusterDetails;
  /**
   * Access rights bitmap for the UI
   */
  bitmapExplore?: number;
  /**
   * Access rights bitmap for downloading the transcript
   */
  bitmapGetTranscript?: number;
}
/**
 * Represents a cluster of text reuse passages
 */
export interface TextReuseCluster {
  id: PassageID;
  /**
   * Percentage of overlap between passages in the cluster
   */
  lexicalOverlap?: number;
  /**
   * Number of passages in cluster
   */
  clusterSize?: number;
  /**
   * Number of connected clusters
   */
  connectedClustersCount?: number;
  /**
   * Time window covered by documents in the cluster
   */
  timeCoverage?: {
    from?: string;
    to?: string;
  };
}
/**
 * Extra details of the cluster
 */
export interface TextReuseClusterDetails {
  facets: {
    /**
     * Facet type
     */
    type?: string;
    /**
     * Number of buckets
     */
    numBuckets?: number;
    buckets?: {
      [k: string]: unknown;
    }[];
  }[];
  /**
   * Resolution for the 'date' facet
   */
  resolution?: "year" | "month" | "day";
}


/**
 * Extra details of the cluster
 */
export interface TextReuseClusterDetails {
  facets: {
    /**
     * Facet type
     */
    type?: string;
    /**
     * Number of buckets
     */
    numBuckets?: number;
    buckets?: {
      [k: string]: unknown;
    }[];
  }[];
  /**
   * Resolution for the 'date' facet
   */
  resolution?: "year" | "month" | "day";
}


/**
 * ID of the text reuse passage
 */
export type PassageID = string;
/**
 * ID of the article
 */
export type ArticleID = string;
/**
 * ID of the cluster
 */
export type ClusterID = string;
/**
 * The size of the cluster
 */
export type ClusterSize = number;
/**
 * The time difference in days between the two articles
 */
export type TimeDifferenceInDays = number;
/**
 * The lexical overlap between the two articles
 */
export type LexicalOverlap = number;

/**
 * Represents a passage of text that was identified as a part of a text reuse cluster
 */
export interface TextReusePassage {
  id: PassageID;
  article: ArticleDetails;
  textReuseCluster: ClusterDetails;
  offsetStart: number | null;
  offsetEnd: number | null;
  /**
   * Textual content of the passage
   */
  content: string;
  /**
   * Title of the content item (article) where this passage was found
   */
  title: string;
  connectedClusters?: {
    /**
     * ID of the connected cluster
     */
    id: string;
  }[];
  /**
   * TBD
   */
  isFront?: boolean;
  /**
   * Size of the passage
   */
  size?: number;
  newspaper?: {
    [k: string]: unknown;
  };
  /**
   * Issue details
   */
  issue?: {
    /**
     * ID of the issue
     */
    id: string;
  };
  /**
   * Date of the item (article) where this passage was found
   */
  date?: string;
  /**
   * Bounding box of the passage in the page
   */
  pageRegions?: string[];
  /**
   * Numbers of the pages where the passage was found
   */
  pageNumbers: number[];
  /**
   * Collection IDs the passage belongs to
   */
  collections: string[];
  /**
   * Access rights bitmap for the UI
   */
  bitmapExplore?: number;
  /**
   * Access rights bitmap for downloading the transcript
   */
  bitmapGetTranscript?: number;
}
/**
 * Details of the article the passage belongs to
 */
export interface ArticleDetails {
  id: ArticleID;
}
/**
 * Details of the cluster the passage belongs to
 */
export interface ClusterDetails {
  id: ClusterID;
  clusterSize?: ClusterSize;
  timeDifferenceDay?: TimeDifferenceInDays;
  lexicalOverlap?: LexicalOverlap;
}


/**
 * A topic (TODO)
 */
export interface Topic {
  /**
   * The unique identifier of the topic
   */
  uid: string;
  /**
   * The language code of the topic
   */
  language: string;
  /**
   * TODO
   */
  community?: string;
  /**
   * TODO
   */
  pagerank?: number;
  /**
   * TODO
   */
  degree?: number;
  /**
   * TODO
   */
  x?: number;
  /**
   * TODO
   */
  y?: number;
  relatedTopics?: {
    /**
     * The unique identifier of the related topic
     */
    uid: string;
    /**
     * TODO
     */
    w: number;
    /**
     * TODO
     */
    avg?: number;
  }[];
  /**
   * TODO
   */
  countItems?: number;
  /**
   * TODO
   */
  excerpt?: TopicWord[];
  /**
   * TODO
   */
  words?: TopicWord[];
  /**
   * ID of the model used to generate the topic
   */
  model?: string;
}
/**
 * TODO
 */
export interface TopicWord {
  /**
   * Word
   */
  w: string;
  /**
   * TODO
   */
  p: number;
  /**
   * TODO
   */
  h?: string[];
}


/**
 * TODO
 */
export interface TopicWord {
  /**
   * Word
   */
  w: string;
  /**
   * TODO
   */
  p: number;
  /**
   * TODO
   */
  h?: string[];
}


/**
 * User details
 */
export interface User {
  id: number;
  username: string;
  firstname: string;
  lastname: string;
  isStaff: boolean;
  isActive: boolean;
  isSuperuser: boolean;
  uid: string;
}


/**
 * Version of the API. Contains information about the current version of the API, features, etc.
 */
export interface VersionDetails {
  solr: {
    endpoints?: {
      [k: string]: string;
    };
    [k: string]: unknown;
  };
  mysql: {
    endpoint?: string;
    [k: string]: unknown;
  };
  version: string;
  apiVersion: {
    branch?: string;
    revision?: string;
    version?: string;
    [k: string]: unknown;
  };
  documentsDateSpan: {
    start?: string;
    end?: string;
    [k: string]: unknown;
  };
  newspapers: {
    [k: string]: {
      name?: string;
      [k: string]: unknown;
    };
  };
  features: {
    [k: string]: {
      [k: string]: unknown;
    };
  };
}


/**
 * Details of a wikidata entity
 */
export interface WikidataEntityDetailsTODOAddPersonLocationSpecificFields {
  id: string;
  type: string;
  /**
   * Labels of the entity. Key is the language code.
   */
  labels: {
    [k: string]: string;
  };
  /**
   * Labels of the entity. Key is the language code.
   */
  descriptions: {
    [k: string]: string;
  };
  images: {
    value: string;
    rank: string;
    datatype: string;
    [k: string]: unknown;
  }[];
  [k: string]: unknown;
}


/**
 * A year (TODO)
 */
export interface Year {
  /**
   * Numeric representation of the year
   */
  uid?: number;
  values?: YearWeights;
  refs?: YearWeights;
}
/**
 * Total items counts within a year
 */
export interface YearWeights {
  /**
   * Number of content items
   */
  c?: number;
  /**
   * Number of articles
   */
  a?: number;
  /**
   * Number of pages
   */
  p?: number;
  /**
   * Number of issues
   */
  i?: number;
  /**
   * Number of images (with or without vectors)
   */
  m?: number;
}


/**
 * Total items counts within a year
 */
export interface YearWeights {
  /**
   * Number of content items
   */
  c?: number;
  /**
   * Number of articles
   */
  a?: number;
  /**
   * Number of pages
   */
  p?: number;
  /**
   * Number of issues
   */
  i?: number;
  /**
   * Number of images (with or without vectors)
   */
  m?: number;
}
