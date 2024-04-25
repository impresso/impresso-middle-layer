/**
 * Search find response (articles)
 */
export interface SearchFindResponse {
    data: any[];
}

/**
 * A journal/magazine article
 */
export interface ArticlesGet {
    /**
     * The excerpt of the article
     */
    excerpt: string;
    /**
     * TODO
     */
    isCC:       boolean;
    locations?: Entity[];
    /**
     * The number of pages in this article
     */
    nbPages:  number;
    pages:    Page[];
    persons?: Entity[];
    /**
     * The size of the article in characters
     */
    size: number;
    /**
     * The title of the article
     */
    title: string;
    /**
     * The type of the article. NOTE: may be empty.
     */
    type: string;
    /**
     * The unique identifier of the article
     */
    uid: string;
}

/**
 * An entity like location, person, etc
 */
export interface Entity {
    /**
     * Relevance of the entity in the document
     */
    relevance: number;
    /**
     * Unique identifier of the entity
     */
    uid: string;
}

/**
 * A page of an article
 */
export interface Page {
    /**
     * The access rights code
     */
    accessRights: string;
    /**
     * Whether the page has coordinates
     */
    hasCoords: boolean;
    /**
     * Whether the page has errors
     */
    hasErrors: boolean;
    /**
     * The IIF image file name of the page
     */
    iiif: string;
    /**
     * The IIIF fragment of the page, image file name
     */
    iiifFragment?: string;
    /**
     * The IIF image thumbnail file name of the page
     */
    iiifThumbnail: string;
    /**
     * Reference to the article
     */
    issueUid: string;
    /**
     * Page labels
     */
    labels: string[];
    /**
     * Unique ID of the newspaper
     */
    newspaperUid: string;
    /**
     * The number of the page
     */
    num: number;
    /**
     * Whether the page image has been obfuscated because the user is not authorised to access it
     */
    obfuscated?: boolean;
    /**
     * Regions of the page
     */
    regions: { [key: string]: any }[];
    /**
     * The unique identifier of the page
     */
    uid: string;
}

export interface AuthenticationResponse {
    accessToken:    string;
    authentication: Authentication;
    user:           User;
}

export interface Authentication {
    payload?:  { [key: string]: any };
    strategy?: string;
    [property: string]: any;
}

/**
 * User details
 */
export interface User {
    firstname:   string;
    id:          number;
    isActive:    boolean;
    isStaff:     boolean;
    isSuperuser: boolean;
    lastname:    string;
    uid:         string;
    username:    string;
}

/**
 * Search find response (articles)
 */
export interface BaseFindResponse {
    data: any[];
    /**
     * Additional information about the response.
     */
    info: { [key: string]: any };
    /**
     * The number of items returned in this response
     */
    limit: number;
    /**
     * The number of items skipped in this response
     */
    skip: number;
    /**
     * The total number of items matching the query
     */
    total: number;
}

/**
 * Collectable Item find response
 *
 * Search find response (articles)
 */
export interface CollectableItemFindResponse {
    data: any[];
}

/**
 * Description of the collection object (Collection class)
 */
export interface CollectionsGet {
    countItems:       number | string;
    creationDate:     string;
    creator:          BaseUser;
    description:      string;
    labels?:          string[];
    lastModifiedDate: string;
    name:             string;
    status:           string;
    uid:              string;
}

export interface BaseUser {
    uid:      string;
    username: string;
    [property: string]: any;
}

/**
 * Collections find response
 *
 * Search find response (articles)
 */
export interface CollectionsFindResponse {
    data: any[];
}

/**
 * Remove collection response
 */
export interface RemoveCollectionResponse {
    params: Params;
    /**
     * Deletion task details
     */
    task: Task;
}

export interface Params {
    /**
     * The collection id
     */
    id?: string;
    /**
     * The status of the operation
     */
    status?: Status;
}

/**
 * The status of the operation
 */
export enum Status {
    Del = "DEL",
}

/**
 * Deletion task details
 */
export interface Task {
    /**
     * When task was created
     */
    creationDate?: string;
    /**
     * The ID of the task
     */
    task_id?: string;
}

export interface FindTextReuseClustersResponse {
    clusters: GetTextReuseClusterResponse[];
    info:     Pagination;
}

export interface GetTextReuseClusterResponse {
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

/**
 * TODO: review this schema
 */
export interface Pagination {
    /**
     * Limit to this many items
     */
    limit?: number;
    /**
     * Skip this many items
     */
    offset?: number;
    /**
     * Display N-th page (using 'limit' as the number of items in the page)
     */
    page?: number;
    /**
     * Skip this many items
     */
    skip?: number;
    /**
     * Total items available
     */
    total?: number;
    [property: string]: any;
}

/**
 * Collections find response
 *
 * Search find response (articles)
 */
export interface TextReusePassageFindResponse {
    data: any[];
}

/**
 * Represents a passage of text that was identified as a part of a text reuse cluster
 */
export interface TextReusePassagesGet {
    /**
     * Details of the article the passage belongs to
     */
    article: ArticleDetails;
    /**
     * Collection IDs the passage belongs to
     */
    collections: string[];
    /**
     * Details of the connected clusters
     */
    connectedClusters?: ConnectedClusters;
    /**
     * Textual content of the passage
     */
    content: string;
    /**
     * Date of the item (article) where this passage was found
     */
    date?: Date;
    /**
     * ID of the text reuse passage
     */
    id: string;
    /**
     * TBD
     */
    isFront?: boolean;
    /**
     * Issue details
     */
    issue?: Issue;
    /**
     * Newspaper details
     */
    newspaper?:  Newspaper;
    offsetEnd:   number;
    offsetStart: number;
    /**
     * Numbers of the pages where the passage was found
     */
    pageNumbers: number[];
    /**
     * Bounding box of the passage in the page
     */
    pageRegions: string[];
    /**
     * Size of the passage
     */
    size?: number;
    /**
     * Details of the cluster the passage belongs to
     */
    textReuseCluster: ClusterDetails;
    /**
     * Title of the content item (article) where this passage was found
     */
    title: string;
}

/**
 * Details of the article the passage belongs to
 */
export interface ArticleDetails {
    /**
     * ID of the article
     */
    id: string;
}

/**
 * Details of the connected clusters
 */
export interface ConnectedClusters {
    /**
     * ID of the connected cluster
     */
    id: string;
}

/**
 * Issue details
 */
export interface Issue {
    /**
     * ID of the issue
     */
    id: string;
}

/**
 * Newspaper details
 */
export interface Newspaper {
    /**
     * ID of the newspaper
     */
    id: string;
}

/**
 * Details of the cluster the passage belongs to
 */
export interface ClusterDetails {
    /**
     * The size of the cluster
     */
    clusterSize: number;
    /**
     * ID of the cluster
     */
    id: string;
    /**
     * The lexical overlap between the two articles
     */
    lexicalOverlap?: number;
    /**
     * The time difference in days between the two articles
     */
    timeDifferenceDay?: number;
}

/**
 * Version of the API. Contains information about the current version of the API, features,
 * etc.
 */
export interface APIVersion {
    apiVersion:        APIVersionObject;
    documentsDateSpan: DocumentsDateSpan;
    features:          { [key: string]: any };
    mysql:             Mysql;
    newspapers:        { [key: string]: any };
    solr:              Solr;
    version:           string;
}

export interface APIVersionObject {
    branch?:   string;
    revision?: string;
    version?:  string;
    [property: string]: any;
}

export interface DocumentsDateSpan {
    end?:   any;
    start?: any;
    [property: string]: any;
}

export interface Mysql {
    endpoint?: string;
    [property: string]: any;
}

export interface Solr {
    endpoints?: { [key: string]: any };
    [property: string]: any;
}
