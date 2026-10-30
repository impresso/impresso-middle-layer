# impresso-middle-layer

`impresso-middle-layer` is the API server for the [Impresso](https://impresso-project.ch/) platform. It provides the internal API used by the web application and a configurable public API for third-party clients.

The server is built with Feathers 5, TypeScript, and ESM. It integrates with MySQL through Sequelize, Redis, Solr, IIIF image services, and BullMQ. A Celery client remains available when enabled in configuration.

## Requirements

- Node.js 20 or later
- npm
- Redis
- Reachable MySQL and Solr instances with the required Impresso data and credentials

Local development also normally requires access to the configured IIIF services. Some startup tasks retrieve metadata from external Impresso services.

## Installation and configuration

Install dependencies from the lockfile:

```shell
npm ci
```

The application loads its base configuration from `config/default.json` and overlays the configuration for `NODE_ENV`, such as `config/development.json`. Both `npm run dev` and `npm start` load variables from `.env`.

Configure the database, Solr, authentication, IIIF, and any enabled external services for your environment. Configuration values expressed as `${VARIABLE_NAME}` must be provided in `.env` or the process environment. Do not commit secrets or environment-specific production configuration.

The committed development configuration requires at least these variables:

```text
AUTH_SECRET
DB_USERNAME
DB_PASSWORD
SOLR_READER_USERNAME
SOLR_READER_PASSWORD
SOLR_WRITER_USERNAME
SOLR_WRITER_PASSWORD
IIIF_LORS_USERNAME
IIIF_LORS_PASSWORD
IIIF_CANTALOUPE_USERNAME
IIIF_CANTALOUPE_PASSWORD
```

## Run locally

Start the development server with file watching:

```shell
npm run dev
```

The default server address is `http://localhost:3030`.

Start with the production configuration:

```shell
NODE_ENV=production npm start
```

`make run-dev` is an optional wrapper around `npm run dev` that also exposes Git revision metadata to the process.

## API modes

The API mode is selected by the `isPublicApi` configuration value.

- When `isPublicApi` is `false` or unset, the internal API is loaded and Socket.IO is enabled.
- When `isPublicApi` is `true`, the public API service surface is loaded, REST and CORS are enabled, and requests and responses are validated against the OpenAPI specification.
- The supplied `config/development.json` currently enables public API mode.

Swagger UI and the OpenAPI document are available only in public API mode at `/docs` and `/swagger.json`, respectively. The public configuration should use a distinct JWT audience, suitable expiry, disabled cookie authentication, and rate-limit settings appropriate to its clients. Configure `imlAuthConfiguration` when the public API must validate tokens issued by the Impresso web application.

## Docker and Compose

Build the image:

```shell
make build
```

Run it with the repository configuration mounted:

```shell
make run
```

The container exposes port `3030`. Supply required environment variables and provide configuration suitable for the container's network.

`docker-compose.yml` provides:

- Redis on `localhost:6379`, with persistent data under `docker/redis`.
- An optional SOCKS proxy on `localhost:1080`, configured with files under `docker/config/ssh`.
- An optional application service enabled with `docker-compose --profile iml up`.

Compose does not provision MySQL or Solr; configure reachable external instances. To use the SOCKS proxy, provide an SSH configuration under `docker/config/ssh` with a `socks-proxy` host entry.

## Development commands

```shell
# Type checking
npm run typecheck

# Lint source files
npm run lint

# Apply ESLint fixes
npm run lintfix

# Run the default test suite (excludes integration tests)
npm test

# Watch tests
npm run test-watch

# Run integration tests
npm run integration-test

# Run tests matching a name
npm test -- --grep "test name pattern"

# Regenerate TypeScript declarations from JSON schemas
npm run generate-types

# Validate the public OpenAPI document from a running local server
npm run lint-api-spec

# Run administrative CLI commands
npm run cli
```

Integration tests may require configured external dependencies. Generated schema declarations are written under `src/models/generated/`.

## Project structure

- `src/services/` contains Feathers service implementations and service-specific schemas and hooks.
- `src/hooks/` contains shared request and response hooks.
- `src/models/` contains Sequelize models and generated schema types.
- `src/middleware/` configures HTTP middleware, OpenAPI validation, Swagger, IIIF handling, and error handling.
- `src/internalServices/` contains integrations such as Solr, Redis, queues, and caches.
- `src/jobs/` contains startup and asynchronous jobs.
- `config/` contains environment-specific configuration overlays.

Services are registered dynamically in `src/services/index.ts`. Public services are always loaded; internal services, optional administrative endpoints, and optional Barista services depend on API mode and feature flags.

## Background jobs and caches

The server initializes Redis-backed caches and runs startup jobs for data such as topics, media sources, and year statistics. BullMQ is the in-process queue implementation. Celery integration is optional and controlled by the `celery.enable` configuration value.

## Adding indexed Solr fields

Adding an indexed Solr field generally requires coordinated changes in:

1. The filter definition in `impresso-jscommons`, including a unique filter ID.
2. `SolrMappings` in `src/data/constants.ts`.
3. `src/util/solr/solrFilters.yml`, which maps filters to Solr filter-statement builders.
4. Optionally, `src/util/solr/stats.yml` for statistics data points used by charts and graphs.

There are several configuration options that should be set differently in Public API:

 * `isPublicApi` - set to `true` to enable the public API. This configures openapi schema, validation, REST transport.
 * `rateLimiter` - `enabled` must be set to `true` to enable rate limiting. 
   capacity and refill rate should be adjusted too.
 * `authentication.jwtOptions`:
   * `audience` - should be set to the public API URL. This must be different
      from the internal API URL to make sure tokens from one could not be used
      in another.
   * `expiresIn` - should be set to a reasonable value for the public API (e.g. `8h` for 8 hours)
 * `authentication.cookie.enabled` set to `false` - cookies are not used in the public API

Additionally, to enable the public API to verify web app IML token, the following configuration block should be added:

```json
"imlAuthConfiguration": {
  "secret": "IML jwt secret",
  "jwtOptions": {
    "audience": "Web app base URL"
  }
}
```

Where:
  * `secret` - secret used to sign the IML tokens
  * `audience` - base URL of the web app issuing the token.

To let the authentication service know that a new auth strategy is installed, add the following to the "authentication" block:

```json
  "authStrategies": ["local", "jwt-app", "jwt"]
```

#### Rate limiter

Rate limiter has two configuration options:

* `capacity` - the maximum number of requests allocated to a resource/user. This indicates how many request can be executed against the resource before limiting kicks in.
* `refillRate` - how many requests are added to the allocation every second if the allocation is lower than `capacity`.

Sample settings:

* 1 request per second (3600 / hour): `capacity: 3600, refillRate: 1`
* 10 request per second (36000 / hour): `capacity: 36000, refillRate: 10`
* 1 request per second (60 / minute): `capacity: 60, refillRate: 1`
* 1 request per second (600 / 10 minutes): `capacity: 600, refillRate: 1`
* 3 request per second (600 / 10 minutes): `capacity: 600, refillRate: 3`

## Running with a proxy
If database, Solr and/or IIIF server are only accessible via a proxy, you can configure the proxy in the `.env` file:

```shell
IMPRESSO_SOCKS_PROXY_CONFIG='{ "host": "localhost", "port": 1080, "domains": ["db.domain.to.proxy", "solr.domain.to.proxy", "iiif.domain.to.proxy"] }'

```

## Downloading audit logs as a parnter institution

To get the zip archive with *parquet* files run:

```bash
curl -X 'GET' -O -J \
  'http://localhost:3030/partner-audit-logs/BNL?year=2026&month=08' \
  -H 'accept: application/zip' \
  -H 'Authorization: Bearer <token>'
```

## Help

For more information on all the things you can do with Feathers visit [docs.feathersjs.com](http://docs.feathersjs.com).

## Changelog

**1.0.0**

- Public release

## Project

The Impresso - Media Monitoring of the Past project is funded by the Swiss National Science Foundation (SNSF) under grant number [CRSII5_173719](http://p3.snf.ch/project-173719) (Sinergia program). The project develops tools to process and explore large-scale collections of historical newspapers and studies their impact on historical research. More information is available at <https://impresso-project.ch/>.

## License

Copyright (C) 2020 the Impresso team. Contributors include [Daniele Guido](https://github.com/danieleguido), [Roman Kalyakin](https://github.com/theorm), and [Thijs van Beek](https://github.com/tvanbeek).

This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed without any warranty; without even the implied warranty of merchantability or fitness for a particular purpose. See the [GNU Affero General Public License](LICENSE) for details.
