/**
 * Response for GET /text-reuse-clusters/:id
 */
export interface Response {
    cluster:    TextReuseCluster;
    details?:   TextReuseClusterDetails;
    textSample: string;
}

/**
 * Represents a cluster of text reuse passages
 */
export interface TextReuseCluster {
    /**
     * Number of passages in cluster
     */
    clusterSize?: number;
    /**
     * Number of connected clusters
     */
    connectedClustersCount?: number;
    /**
     * ID of the text reuse passage
     */
    id: string;
    /**
     * Percentage of overlap between passages in the cluster
     */
    lexicalOverlap?: number;
    /**
     * Time window covered by documents in the cluster
     */
    timeCoverage?: TimeCoverage;
}

/**
 * Time window covered by documents in the cluster
 */
export interface TimeCoverage {
    from?: Date;
    to?:   Date;
}

/**
 * Extra details of the cluster
 */
export interface TextReuseClusterDetails {
    facets: Facet[];
    /**
     * Resolution for the 'date' facet
     */
    resolution?: Resolution;
}

export interface Facet {
    buckets?: { [key: string]: any }[];
    /**
     * Number of buckets
     */
    numBuckets?: number;
    /**
     * Facet type
     */
    type?: string;
}

/**
 * Resolution for the 'date' facet
 */
export enum Resolution {
    Day = "day",
    Month = "month",
    Year = "year",
}
