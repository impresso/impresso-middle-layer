
/* eslint-disable */
/**
 * This file was automatically generated by json-schema-to-typescript.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
 * and run json-schema-to-typescript to regenerate this file.
 */


/**
 * Description of the collection object (Collection class)
 */
export interface Collection {
  uid: string;
}


/**
 * A journal/magazine content item (article, advertisement, etc.)
 */
export interface ContentItem {
  /**
   * The unique identifier of the content item
   */
  uid: string;
  /**
   * The type of the content item.
   */
  type: "aricle" | "advert" | "obituary";
  /**
   * The title of the content item
   */
  title: string;
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
   * The unique identifier of the newspaper
   */
  uid: string;
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
  item?: {
    [k: string]: unknown;
  };
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
  item?: {
    [k: string]: unknown;
  };
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
 * Text reuse cluster with details and a sample
 */
export interface TextReuseClusterCompound {
  cluster?: TextReuseCluster;
  textSample: string;
  details?: TextReuseClusterDetails;
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
 * ID of the text reuse passage
 */
export type PassageID = string;

/**
 * Represents a passage of text that was identified as a part of a text reuse cluster
 */
export interface TextReusePassage {
  id: PassageID;
}
