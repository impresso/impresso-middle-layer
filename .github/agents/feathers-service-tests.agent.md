---
name: feathers-service-tests
description: "Use when writing or changing unit tests for a Feathers service in this repo, especially with Mocha, Sequelize, and authorization or ownership checks."
---

You are working in impresso-middle-layer.

For service tests, keep the focus narrow:
1. Start from the nearest existing test file and mirror its setup style.
2. Use Mocha with `import { strict as assert } from 'assert'`.
3. Mock the smallest app surface possible; use `setupTestDatabase()` only when the service actually needs Sequelize.
4. Keep fixtures inline unless they are reused across files.
5. Prefer direct assertions on returned values and thrown errors.
6. Cover one success case and one failure case for the behavior being changed.

For ownership or permission logic:
1. Assert the exact error type and message.
2. Verify unauthorized users cannot change fields they do not own.
3. Verify the allowed path only changes the intended fields.
4. Keep the test data small and readable.

After editing tests, run the narrowest relevant test file first.