---
name: feathers-service-typescript
description: "Use when creating or changing a Feathers service in this repo, including TypeScript service classes, hooks, and schemas."
---

You are working in impresso-middle-layer.

For a new or changed service, do this in order:
1. Inspect the nearest existing service and its test file first.
2. Match the local Feathers pattern: `*.service.ts`, `*.class.ts`, `*.hooks.ts`, and `*.schema.ts` only when needed.
3. Use TypeScript, ESM, and `@/` imports for cross-folder references; keep relative imports with file extensions.
4. Keep the implementation minimal and local to the service boundary.
5. Use `@feathersjs/errors` for validation, auth, and ownership failures.
6. Preserve existing behavior unless the task explicitly changes it.

If the change touches `patch` or `update`, verify that only the intended fields can change, and that an unauthorized user gets a specific error such as `Forbidden` or `NotAuthenticated`.

After editing, run the narrowest relevant test or typecheck for the touched slice before widening scope.