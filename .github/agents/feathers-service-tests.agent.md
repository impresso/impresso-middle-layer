---
name: feathers-service-tests
description: "Use when writing or changing unit tests for a Feathers service in this repo, especially with Mocha, Sequelize, and authorization or ownership checks."
---

Keep the focus narrow.

1. Start from the nearest existing test file and mirror its setup style.
2. Use Mocha with `import { strict as assert } from 'assert'`.
3. Mock the smallest app surface possible. Compose it from the `with*` helpers in `helpers/app.ts` via `setupTestApp(...)`, and include `withDatabase()` only when the service actually needs Sequelize. Do not hand-roll a fake `app`.
4. Keep fixtures inline unless they are reused across files. Use small typed fixtures at the top of the test file (`mockUser1`, `mockCollectionForUser1`, ...) with fixed dates.
5. Prefer direct assertions on returned values and thrown errors.
6. Cover at least one success case and one failure case for the behavior being changed.

### Building the mock app with `setupTestApp`

- `setupTestApp(...features)` returns `{ app, teardown, ...extras }`. `app` exposes only `get(key)` and `service(name)`.
- `app.get('x')` returns `undefined` if nothing is registered. `app.service('x')` **throws** `Unexpected service request: x`. If you hit that error, add the missing feature or handler instead of stubbing around it.
- Only include the features the service under test actually touches:

| Service needs | Feature | Exposes |
|---|---|---|
| Sequelize models | `withDatabase()` (in-memory SQLite, `timestamps: false`) | `sequelize` |
| Celery / Redis / magic link / auth config | `withRedisCelery()` | `celeryRunCalls`, `redisSetExCalls` |
| Solr queries | `withSolr()` | `mockSolr`, `solrSelectCalls` |
| BullMQ jobs | `withQueueService()` | `queueService`, `queueServiceCalls` |
| Cache | `withCacheManager()` | `cacheManager` |
| Any other `app.get('name')` config | `withConfig('name', {...})` | none |
| Debug output from `logger.debug` | `withDebugLogging()` (temporary, process-global) | none |

- If none fits, add a new `withX()` feature to `helpers/app.ts` following the same pattern: register `ctx.getHandlers` / `ctx.serviceHandlers`, push a cleanup into `ctx.teardownFns`, and return extras. Don't patch `app` inside a test file.

### Test file skeleton

```ts
let testApp: ReturnType<typeof setupTestApp<[
  ReturnType<typeof withDatabase>,
  ReturnType<typeof withSolr>,
  /* ...same order as the call below */
]>>
let service: MyService

before(async () => {
  testApp = setupTestApp(withDatabase(), withSolr())
  const someModel = SomeModel.sequelize(testApp.sequelize) // register models on testApp.sequelize
  await testApp.sequelize.sync({ force: true })
  service = new MyService(testApp.app)
})

after(async () => { await testApp.teardown() })

beforeEach(async () => {
  await testApp.sequelize.truncate({ cascade: true })
  // reset any mutable mocks here (see "Mocking and asserting")
})
```

- The type annotation and the `setupTestApp(...)` call must list features in the same order.
- Initialize models before `sync({ force: true })`.

### Mocking and asserting

- **Solr:** override `testApp.mockSolr.select = async () => ({...})` inside the test to return the facets or docs you need. Assert on outgoing queries via `testApp.solrSelectCalls`.
- **Queue:** assert `testApp.queueServiceCalls` as `{ method, data }` entries, in order.
- **Celery / Redis:** assert `celeryRunCalls` and `redisSetExCalls`.
- **State isolation:** `testApp` is created once in `before`, so overridden mocks and captured-call arrays persist across tests. In `beforeEach`, reset them (e.g. `testApp.solrSelectCalls.length = 0` and restore the default `mockSolr.select`), or call `setupTestApp` in `beforeEach` if the suite is small.
- Seed data with `model.create(...)` / `bulkCreate(...)`, casting mocks `as any` where models require it.

### What to cover

The minimum is one success case and one failure case per changed behavior. Where relevant, also cover:

- Multiple users or entities, to prove isolation (user A never sees user B's data).
- Filtering and search parameters (`term`, pagination `limit`/`offset`).
- The unauthenticated or empty case, e.g. `service.find({ query: {} } as any)` returning `{ data: [], pagination: { limit: 10, offset: 0, total: 0 } }`.
- Side effects (queue jobs, Celery tasks, Redis writes), asserted through the captured-call extras.

### Style

- Prefer several focused `it(...)` blocks over one long test. Each `it` asserts one behavior.
- No `console.log` in committed tests. Use `withDebugLogging()` only temporarily, and run that file in isolation.
- Remove unused imports.
- Import paths use the `@/` alias and `.js` extensions.

## Ownership and permission logic

1. Assert the exact error type and message.
2. Verify unauthorized users cannot change fields they do not own.
3. Verify the allowed path only changes the intended fields.
4. Keep the test data small and readable.

## Running tests

After editing tests, run the narrowest relevant test file first, in isolation:

```sh
npx mocha path/to/file.test.ts
```

## Deliverable

Return the new or edited test file plus any additions to `helpers/app.ts`, with the narrowest relevant test run confirming it passes.