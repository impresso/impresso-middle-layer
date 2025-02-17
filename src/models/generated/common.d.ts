
/* eslint-disable */
/**
 * This file was automatically generated by json-schema-to-typescript.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
 * and run json-schema-to-typescript to regenerate this file.
 */


/**
 * Impresso config file.
 */
export interface Config {
  $schema?: string;
  /**
   * If `true`, the app serves a public API
   */
  isPublicApi?: boolean;
  /**
   * List of available plans
   */
  availablePlans?: string[];
  /**
   * List of allowed origins for CORS
   */
  allowedCorsOrigins?: string[];
  redis?: RedisConfig;
  /**
   * Rate limiter configuration
   */
  rateLimiter?: {
    /**
     * Enable rate limiter
     */
    enabled?: boolean;
    /**
     * Capacity of the rate limiter
     */
    capacity: number;
    /**
     * Refill rate of the rate limiter
     */
    refillRate: number;
    [k: string]: unknown;
  };
  /**
   * Prefix for the public API
   */
  publicApiPrefix?: string;
  /**
   * If `true`, the user object is loaded from the db on every request. If `false` (default), the user object is created from the JWT token
   */
  useDbUserInRequestContext?: boolean;
  /**
   * Base URI for problem URIs. Falls back to the default URI (https://impresso-project.ch/probs) if not set
   */
  problemUriBase?: string;
  sequelize: SequelizeConfig;
  openapi?: OpenApiConfig;
  /**
   * URL of the Impresso NER service
   */
  impressoNerServiceUrl?: string;
  features?: FeaturesConfig;
  paginate?: PaginateConfig;
  celery?: CeleryConfig;
  authentication: AuthConfig;
  imlAuthConfiguration?: AuthConfig1;
  cache?: CacheConfig;
  appHooks?: AppHooksConfig;
  media?: MediaConfig;
  solrConfiguration: SolrConfiguration;
  proxy?: ProxyConfig;
  recommender?: RecommenderConfig;
  images?: ImagesConfig;
  accessRights?: AccessRightsConfig;
  callbackUrls?: CallbackUrlsConfig;
  /**
   * Host of the server
   */
  host?: string;
  /**
   * Port of the server
   */
  port?: number;
  /**
   * Path to the public folder
   */
  public?: string;
  multer?: MulterConfig;
}
/**
 * Redis configuration
 */
export interface RedisConfig {
  /**
   * Redis host
   */
  host?: string;
  [k: string]: unknown;
}
/**
 * Sequelize configuration
 */
export interface SequelizeConfig {
  /**
   * Alias for the Sequelize instance
   */
  alias?: string;
  /**
   * Dialect of the database
   */
  dialect: string;
  /**
   * Host of the database
   */
  host: string;
  /**
   * Port of the database
   */
  port: number;
  auth: {
    /**
     * Database user
     */
    user: string;
    /**
     * Database password
     */
    pass: string;
    [k: string]: unknown;
  };
  /**
   * Database name
   */
  database: string;
  /**
   * Enable logging
   */
  logging?: boolean;
  tables?: {
    /**
     * Name of the articles table
     */
    articles: string;
    /**
     * Name of the pages table
     */
    pages: string;
    /**
     * Name of the newspapers table
     */
    newspapers: string;
    /**
     * Name of the users table
     */
    users: string;
    [k: string]: unknown;
  };
  [k: string]: unknown;
}
export interface OpenApiConfig {
  /**
   * If `true`, validate requests against the OpenAPI schema
   */
  validateRequests?: boolean;
  /**
   * If `true`, validate responses against the OpenAPI schema
   */
  validateResponses?: boolean;
  /**
   * If `true`, validate the OpenAPI spec
   */
  validateSpec?: boolean;
  [k: string]: unknown;
}
export interface FeaturesConfig {
  textReuse?: {
    /**
     * Enable text reuse features
     */
    enabled: boolean;
    [k: string]: unknown;
  };
  adminEndpoints?: {
    /**
     * Enable admin endpoints (see services/index)
     */
    enabled: boolean;
    [k: string]: unknown;
  };
  [k: string]: unknown;
}
export interface PaginateConfig {
  /**
   * Default limit for pagination
   */
  default: number;
  /**
   * Maximum limit for pagination
   */
  max: number;
  [k: string]: unknown;
}
/**
 * Celery configuration
 */
export interface CeleryConfig {
  /**
   * Enable Celery
   */
  enable?: boolean;
  /**
   * URL of the Redis broker
   */
  brokerUrl: string;
  /**
   * URL of the Redis backend
   */
  backendUrl: string;
  [k: string]: unknown;
}
export interface AuthConfig {
  /**
   * Secret for JWT
   */
  secret: string;
  jwtOptions?: {
    /**
     * Audience for JWT
     */
    audience: string;
    /**
     * Issuer of JWT
     */
    issuer?: string;
    /**
     * Expiration time for JWT
     */
    expiresIn?: string;
    [k: string]: unknown;
  };
  /**
   * List of authentication strategies
   */
  authStrategies?: string[];
  [k: string]: unknown;
}
/**
 * Configuration for the auth strategy in Public API where the API can verify a token from the internal API (IML) using this configuration and then issue a new token for the public API.
 */
export interface AuthConfig1 {
  /**
   * Secret for JWT
   */
  secret: string;
  jwtOptions?: {
    /**
     * Audience for JWT
     */
    audience: string;
    /**
     * Issuer of JWT
     */
    issuer?: string;
    /**
     * Expiration time for JWT
     */
    expiresIn?: string;
    [k: string]: unknown;
  };
  /**
   * List of authentication strategies
   */
  authStrategies?: string[];
  [k: string]: unknown;
}
export interface CacheConfig {
  /**
   * Enable cache
   */
  enabled: boolean;
  [k: string]: unknown;
}
export interface AppHooksConfig {
  /**
   * If `true`, hooks are always required
   */
  alwaysRequired?: boolean;
  /**
   * List of paths to exclude from hooks
   */
  excludePaths?: string[];
  [k: string]: unknown;
}
export interface MediaConfig {
  /**
   * Host of the media server
   */
  host?: string;
  /**
   * Path to the media server
   */
  path?: string;
  /**
   * List of media services
   */
  services?: string[];
  [k: string]: unknown;
}
/**
 * Solr configuration
 */
export interface SolrConfiguration {
  /**
   * List of Solr servers available
   */
  servers?: SolrServerConfiguration[];
  /**
   * List of namespaces (mapped to Solr indices)
   */
  namespaces?: SolrServerNamespaceConfiguration[];
}
export interface SolrServerConfiguration {
  /**
   * Unique identifier for the server, referenced in namespace configuration.
   */
  id: string;
  /**
   * Base URL of the Solr server
   */
  baseUrl: string;
  /**
   * Authentication configuration for reading and writing (Base)
   */
  auth?: {
    read?: SolrServerAuth;
    write?: SolrServerAuth;
  };
  proxy?: SolrServerProxy;
}
/**
 * Authentication configuration for Solr server. Base auth.
 */
export interface SolrServerAuth {
  username: string;
  password: string;
}
/**
 * Proxy configuration for Solr server
 */
export interface SolrServerProxy {
  host: string;
  port: number;
  type?: "socks";
}
/**
 * Namespace configuration. Each namespace is mapped 1:1 to an index in one of the Solr servers.
 */
export interface SolrServerNamespaceConfiguration {
  /**
   * Unique namespace identifier
   */
  namespaceId: string;
  /**
   * Reference to the Solr server
   */
  serverId: string;
  /**
   * Solr index name
   */
  index: string;
  /**
   * Version of the data schema used in the index. Optional.
   */
  schemaVersion?: string;
}
export interface ProxyConfig {
  /**
   * Host of the proxy server
   */
  host?: string;
  /**
   * List of local prefixes to replace in IIIF URLs in Issue pages
   */
  localPrefixes?: string[];
  iiif?: {
    /**
     * If `true`, only internal IIIF URLs are allowed
     */
    internalOnly?: boolean;
    [k: string]: unknown;
  };
  [k: string]: unknown;
}
export interface RecommenderConfig {
  articles: {
    endpoint?: string;
    [k: string]: unknown;
  };
  [k: string]: unknown;
}
export interface ImagesConfig {
  visualSignature?: {
    endpoint?: string;
    [k: string]: unknown;
  };
  [k: string]: unknown;
}
export interface AccessRightsConfig {
  /**
   * If `true`, show excerpt
   */
  showExcerpt?: boolean;
  [k: string]: unknown;
}
export interface CallbackUrlsConfig {
  passwordReset?: string;
  [k: string]: unknown;
}
export interface MulterConfig {
  /**
   * Destination folder for uploads
   */
  dest: string;
  [k: string]: unknown;
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
   * DEPRECATED. Display N-th page (using 'limit' as the number of items in the page). Only used in the web app.
   */
  page?: number;
  /**
   * Total items available
   */
  total?: number;
  [k: string]: unknown;
}


export interface RedactionPolicy {
  name: string;
  items: RedactionPolicyItem[];
  [k: string]: unknown;
}
export interface RedactionPolicyItem {
  jsonPath: string;
  valueConverterName: "redact" | "contextNotAllowedImage" | "remove" | "emptyArray";
  [k: string]: unknown;
}


/**
 * Solr configuration
 */
export interface SolrConfiguration {
  /**
   * List of Solr servers available
   */
  servers?: SolrServerConfiguration[];
  /**
   * List of namespaces (mapped to Solr indices)
   */
  namespaces?: SolrServerNamespaceConfiguration[];
}
export interface SolrServerConfiguration {
  /**
   * Unique identifier for the server, referenced in namespace configuration.
   */
  id: string;
  /**
   * Base URL of the Solr server
   */
  baseUrl: string;
  /**
   * Authentication configuration for reading and writing (Base)
   */
  auth?: {
    read?: SolrServerAuth;
    write?: SolrServerAuth;
  };
  proxy?: SolrServerProxy;
}
/**
 * Authentication configuration for Solr server. Base auth.
 */
export interface SolrServerAuth {
  username: string;
  password: string;
}
/**
 * Proxy configuration for Solr server
 */
export interface SolrServerProxy {
  host: string;
  port: number;
  type?: "socks";
}
/**
 * Namespace configuration. Each namespace is mapped 1:1 to an index in one of the Solr servers.
 */
export interface SolrServerNamespaceConfiguration {
  /**
   * Unique namespace identifier
   */
  namespaceId: string;
  /**
   * Reference to the Solr server
   */
  serverId: string;
  /**
   * Solr index name
   */
  index: string;
  /**
   * Version of the data schema used in the index. Optional.
   */
  schemaVersion?: string;
}


export interface SolrFiltersConfiguration {
  /**
   * Indexes (by Solr namespace) with their filter definitions.
   */
  indexes?: {
    [k: string]: IndexDefinition;
  };
}
/**
 * An index configuration with a set of filters.
 *
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` "^.*$".
 */
export interface IndexDefinition {
  /**
   * Filters available for this index.
   */
  filters: {
    [k: string]: FilterDefinition;
  };
}
/**
 * A filter definition with a field and a rule.
 *
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` "^.*$".
 */
export interface FilterDefinition {
  field:
    | string
    | string[]
    | {
        /**
         * Field prefix to be expanded according to supported languages.
         */
        prefix: string;
      };
  /**
   * The name of the rule to parse the filter value.
   */
  rule: string;
}


/**
 * Schema for stats.yml
 */
export interface StatsConfiguration {
  indexes: Indexes;
}
/**
 * Indexes configuration
 */
export interface Indexes {
  [k: string]: Index;
}
/**
 * This interface was referenced by `Indexes`'s JSON-Schema definition
 * via the `patternProperty` ".*".
 */
export interface Index {
  facets: FacetTypeGroup;
}
/**
 * Facets group configuration
 */
export interface FacetTypeGroup {
  term?: FacetSet;
  numeric?: FacetSet;
  temporal?: FacetSet;
}
/**
 * Facet set configuration
 */
export interface FacetSet {
  [k: string]: Facet;
}
/**
 * Single facet description
 *
 * This interface was referenced by `FacetSet`'s JSON-Schema definition
 * via the `patternProperty` ".*".
 */
export interface Facet {
  /**
   * Solr field name
   */
  field: string;
  /**
   * Limit of buckets returned
   */
  limit?: number;
}
