/**
 * A journal/magazine article
 */
export interface Article {
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

/**
 * Description of the collection object (Collection class)
 */
export interface Collection {
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
 * Default error response. TODO: replace with https://datatracker.ietf.org/doc/html/rfc9457
 */
export interface Error {
    data?:   any[] | { [key: string]: any };
    message: string;
    [property: string]: any;
}

/**
 * A single filter criteria
 */
export interface Filter {
    context?:   Context;
    daterange?: string;
    op?:        Op;
    precision?: Precision;
    q?:         string[] | string;
    /**
     * Possible values are in 'search.validators:eachFilterValidator.type.choices'
     */
    type:  string;
    uid?:  string;
    uids?: string;
}

export enum Context {
    Exclude = "exclude",
    Include = "include",
}

export enum Op {
    And = "AND",
    Or = "OR",
}

export enum Precision {
    Exact = "exact",
    Fuzzy = "fuzzy",
    Partial = "partial",
    Soft = "soft",
}

/**
 * Represents a passage of text that was identified as a part of a text reuse cluster
 */
export interface TextReusePassage {
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
