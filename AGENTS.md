# AGENTS.md

This file provides guidance to AI coding agents when working with code in this repository.

## Project Overview

**impresso-middle-layer** is a Feathers.js-based API server for the Impresso (Media Monitoring of the Past) project. It provides both an internal API for the impresso web application and an optional public API for third-party clients. The system integrates with multiple data sources including Solr, MySQL and Redis.

## Development Commands

### Building and Running

- **Development server**: `npm run dev` - Runs the app directly with tsx (uses `.env` file)
- **Development with bun**: `bun run dev` - Alternative: Run the app with bun runtime
- **Production start**: `NODE_ENV=production npm start` - Run the app with tsx in production config

### Testing

- **Run all tests**: `npm test` - Runs all unit tests (excluding integration tests)
- **Watch tests**: `npm test-watch` - Run tests in watch mode
- **Integration tests**: `npm run integration-test` - Run integration tests only
- **Run single test**: `npm test -- --grep "test name pattern"` - Run tests matching pattern

### Code Quality

- **Lint check**: `npm run lint` - Check code with ESLint
- **Auto-fix linting**: `npm run lintfix` - Automatically fix ESLint issues
- **Type generation**: `npm run generate-types` - Generate TypeScript types from JSON schemas (run when schemas update)
- **Lint API spec**: `npm run lint-api-spec` - Validate OpenAPI/Swagger spec (requires server running at `http://localhost:3030`)

### Administrative Tasks

- **CLI admin commands**: `npm run cli` - Run administrative CLI tasks

## Architecture

### Core Framework & Libraries

The application uses **Feathers.js 5.x**, a real-time application framework built on Express.js. Key integrations:
- **Authentication**: JWT and local strategies (`@feathersjs/authentication`)
- **Database**: Sequelize ORM with MySQL/PostgreSQL support (Sequelize v6+)
- **Real-time**: Socket.io for WebSocket communication
- **Search**: Feathers Solr adapter for full-text search queries
- **Caching**: Redis for session/cache management
- **Task Queue**: Bull MQ for async job processing

### Application Structure

**Initialization Flow** ([src/app.ts](src/app.ts)):
1. Configuration loading
2. Database (Sequelize) initialization
3. Redis and internal services (rate limiter, quota checker, caching)
4. Security middleware (Helmet, compression, body parsing)
5. Express static routes and middleware
6. Swagger/OpenAPI documentation
7. Transport configuration (REST and Socket.io)
8. Authentication setup
9. Job queue configuration
10. Service registration
11. Application hooks and async startup jobs

**Key Directories**:
- `src/services/` - Feathers service implementations (one per REST endpoint)
- `src/hooks/` - Feathers hooks for request/response processing (authentication, schema validation, transformation)
- `src/models/` - Data models and TypeScript interfaces
- `src/middleware/` - Express middleware (error handling, IIIF, image proxy, OpenAPI validation)
- `src/util/` - Utility functions (crypto, configuration, serialization)
- `src/internalServices/` - Internal non-Feathers services (Solr, Redis, queue manager)
- `src/jobs/` - Async jobs (topic/media source caching, year updates)
- `config/` - Configuration files (development.json, production.json)

### Services Architecture

Services are loaded dynamically based on API mode:

**Public API Services** (`isPublicApi: true`):
- Core endpoints: search, content-items, collections, text-reuse-passages/clusters
- Data endpoints: entities, media-sources, topics, newspapers
- User-facing: images, experiments, logs, version

**Internal API Services** (additional services when `isPublicApi: false`):
- Content management: issues, suggestions, pages, uploaded-images
- Analytics: mentions, embeddings, stats, ngram-trends, topics-graph
- User tools: search-queries, search-exporter, search-queries-comparison
- Account: me, subscriptions, user-requests, password-reset, change-password
- Admin: articles-recommendations, datalab-support, special-membership-access

**Service Structure**:
Each service typically has:
- `{service}.service.ts` - Service configuration and registration
- `{service}.class.ts` - Service class with CRUD methods
- `{service}.hooks.ts` - Hooks for validation, authentication, transformation
- `{service}.schema.ts` - JSON Schema definitions for OpenAPI

### Data & Query Layer

**Solr Search Integration** ([src/solr/queryBuilders.ts](src/solr/queryBuilders.ts)):
- Query builders map application filters to Solr faceted queries
- Filter logic handled by `impresso-jscommons` library
- Results transformed via transformers ([src/transformers/](src/transformers/))

**Field Mapping** ([src/data/constants.ts](src/data/constants.ts)):
- `SolrMappings` defines filter names to Solr faceting configuration
- New indexed fields require updates in:
  1. `impresso-jscommons` protobuf definition
  2. `SolrMappings` in constants.ts
  3. `solrFilters.yml` filter statement builder
  4. Optional: `stats.yml` for statistical data points

**Database**: Sequelize models for users, collections, issues, etc. See `src/models/` for schema definitions. All new code must follow Sequelize v6 design patterns.

### Configuration

Configuration files use Feathers' configuration loader with environment overrides:
- **Base**: `config/default.json`
- **Development**: `config/development.json` (when `NODE_ENV=development`)
- **Production**: `config/production.json` (when `NODE_ENV=production`)
- **Environment variables**: `.env` file loaded by dotenv

**Public API Configuration** (set `isPublicApi: true`):
- `isPublicApi` - Enable public API mode
- `rateLimiter` - Rate limiting configuration (capacity, refillRate)
- `authentication.jwtOptions` - Audience and expiration settings
- `authentication.cookie.enabled` - Set to false for public API
- Optional: `imlAuthConfiguration` - Verify web app IML tokens

**Key Config Variables**:
- `host`, `port` - Server listening address
- `sequelize` - Database connection
- `redis` - Redis connection
- `solr` - Solr server configuration
- `features` - Feature flags (barista integration, admin endpoints, etc.)

### Hooks & Middleware Pattern

**Feathers Hooks** execute before/after service methods:
- **Before hooks**: Authentication, schema validation, parameter parsing
- **After hooks**: Response transformation, data redaction (for sensitive content)

Key hooks:
- [src/hooks/authenticate.ts](src/hooks/authenticate.ts) - Authentication enforcement
- [src/hooks/schema.ts](src/hooks/schema.ts) - JSON Schema validation
- [src/hooks/transformation.ts](src/hooks/transformation.ts) - Response transformation
- [src/hooks/public-api.ts](src/hooks/public-api.ts) - Public API restrictions
- [src/hooks/rateLimiter.ts](src/hooks/rateLimiter.ts) - Rate limiting

**Express Middleware** ([src/middleware/](src/middleware/)):
- Custom error handling with redaction of sensitive data
- OpenAPI validation (when `isPublicApi: true`)
- IIIF protocol handling
- Image proxy for content access

### Authentication & Authorization

- JWT tokens with configurable audience and expiration
- Local strategy for development
- OAuth via passport-github
- User role-based service restrictions
- Quota checking integrated with Redis

User context accessible in services via `context.params.user`.

### Real-Time Communication

Socket.io integration configured in [src/channels.ts](src/channels.ts). Services can push real-time updates through channels based on user authentication and data ownership.

### Job Queue System

Two queue systems available:
- **Celery** (legacy): External Python task queue via celery-node
- **Bull MQ** (current): Node.js in-process queue with Redis backing

Startup jobs run after app initialization:
- Topic cache updates
- Media source cache updates
- Year statistics computation

See [src/jobs/](src/jobs/) for job implementations.

## Development Patterns

### Adding a New Service

1. Create directory: `src/services/{service-name}/`
2. Create files:
   - `{service-name}.service.ts` - Export async config function
   - `{service-name}.class.ts` - Service class extending Feathers base
   - `{service-name}.hooks.ts` - Define before/after hooks
   - `{service-name}.schema.ts` - OpenAPI schema (if public API)
3. Add service name to appropriate array in [src/services/index.ts](src/services/index.ts)
4. Register in service class constructor:
   ```typescript
   app.use(`/path`, new ServiceClass())
   ```

**Improtant** Use Feathersjs v5+ design patterns.

### Adding Solr Fields

When adding a new indexed Solr field:
1. Update `impresso-jscommons` protobuf definition
2. Add mapping to `SolrMappings` in [src/data/constants.ts](src/data/constants.ts)
3. Add filter builder function to `solrFilters.yml`
4. Optionally add statistical mapping in `stats.yml`

### TypeScript Types from JSON Schema

After updating JSON schemas in the codebase, regenerate TypeScript types:
```bash
npm run generate-types
```

Generated types appear in [src/models/generated/](src/models/generated/).

### Error Handling

Feathers errors are automatically serialized to HTTP responses. Use error classes from `@feathersjs/errors`:
```typescript
throw new BadRequest('Invalid parameter')
throw new Forbidden('Access denied')
throw new NotFound('Resource not found')
```

Error details are redacted in production to avoid leaking sensitive information.

### ESM support

- **Always use ESM syntax** (import/export) for all new files and refactors.
- **Prohibited**: Do not use CommonJS syntax (require(), module.exports, or exports).
- **File Extensions**: Use .js or .ts (ensure package.json contains "type": "module"). If a specific configuration file requires CommonJS, use the .cjs extension explicitly.
- **Imports**: Always include file extensions in relative import paths (e.g., `import { user } from './models/user.js'`) to maintain compatibility with standard ESM behavior.

## Testing Patterns

Tests use **Mocha** with **Sinon** for mocking:
- **Unit tests** in `test/unit/` - Fast, no external dependencies
- **Integration tests** in `test/integration/` - Full system with database/Redis
- Run unit tests by default with `npm test`
- Run integration tests separately with `npm run integration-test`

Test helpers available:
- Sinon stubs for mocking services and external calls
- Database fixtures for seeding test data

## Configuration for Different Environments

### Local Development

```bash
npm install
npm run dev  # Start the development server with hot reload (with .env file)
```

Enable specific features via `config/development.json`:
- `isPublicApi: false` - Use internal API services
- `DEBUG=impresso*` - Enable debug logging

### Production Deployment

1. Create `config/production.json` with production settings
2. Start: `NODE_ENV=production npm start`

Use `.env` for sensitive values (database passwords, API keys).

### Public API Mode

Set `isPublicApi: true` in configuration to:
- Enable only public service endpoints
- Activate OpenAPI validation
- Publish Swagger documentation at `/docs`
- Enforce rate limiting

## Useful Debugging

- **Enable debug logging**: `DEBUG=impresso* npm run dev`
- **Check configuration**: Configuration is logged during startup
- **Database debugging**: Sequelize logs queries with `DEBUG=sequelize*`
- **Redis commands**: Monitor with `redis-cli MONITOR`
- **API spec validation**: `npm run lint-api-spec` (requires server running)

## Important Notes

- The application uses a **path alias** `@/*` mapped to `./src/*` for cleaner imports (use `@` instead of relative import unless the import is from the same folder).
- **Node.js requirement**: >= 20.0.0
- **Runtime**: Uses tsx for TypeScript execution (or bun as an alternative)
- **Sensitive data redaction**: Passwords, tokens, and PII are automatically redacted in logs and error responses
- **Legacy code**: The repository contains legacy code that should not be used as a design pattern reference. All new code must use Sequelize v6+, Feathersjs v5+, bullmq queue. All public services should have a json schema for input/output.

