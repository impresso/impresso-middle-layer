/**
 * Response for GET /text-reuse-clusters
 */
export interface FindTextReuseClustersResponse {
  clusters: ClusterElement[]
  info: Info
}

/**
 * Response for GET /text-reuse-clusters/:id
 */
export interface ClusterElement {
  cluster: TextReuseCluster
  details?: TextReuseClusterDetails
  textSample: string
}

/**
 * Represents a cluster of text reuse passages
 */
export interface TextReuseCluster {
  /**
   * Number of passages in cluster
   */
  clusterSize?: number
  /**
   * Number of connected clusters
   */
  connectedClustersCount?: number
  /**
   * ID of the text reuse passage
   */
  id: string
  /**
   * Percentage of overlap between passages in the cluster
   */
  lexicalOverlap?: number
  /**
   * Time window covered by documents in the cluster
   */
  timeCoverage?: TimeCoverage
}

/**
 * Time window covered by documents in the cluster
 */
export interface TimeCoverage {
  from?: Date
  to?: Date
}

/**
 * Extra details of the cluster
 */
export interface TextReuseClusterDetails {
  facets: Facet[]
  /**
   * Resolution for the 'date' facet
   */
  resolution?: Resolution
}

export interface Facet {
  buckets?: { [key: string]: any }[]
  /**
   * Number of buckets
   */
  numBuckets?: number
  /**
   * Facet type
   */
  type?: string
}

/**
 * Resolution for the 'date' facet
 */
export enum Resolution {
  Day = 'day',
  Month = 'month',
  Year = 'year',
}

/**
 * Request payload for POST /search-queries-comparison/intersection
 */
export interface Info {
  /**
   * Limit to this many items
   */
  limit?: number
  /**
   * Skip this many items
   */
  offset?: number
  /**
   * Display N-th page (using 'limit' as the number of items in the page)
   */
  page?: number
  /**
   * Total items available
   */
  total?: number
  [property: string]: any
}

/**
 * Response for GET /text-reuse-clusters/:id
 */
export interface GetTextReuseClusterResponse {
  cluster: TextReuseCluster
  details?: TextReuseClusterDetails
  textSample: string
}
