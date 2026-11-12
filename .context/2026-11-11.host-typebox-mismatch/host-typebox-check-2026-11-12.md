---
date: 2026-11-12
domains: [extensions, testing]
topics: [typebox, omp, checkSchema, token-attribution]
subject: 2026-11-11.host-typebox-mismatch
artifacts: [plan-host-typebox-mismatch.md]
related: []
priority: high
status: active
---

OMP rewrites the exact specifier `@sinclair/typebox` to a Zod-backed shim and does not rewrite `@sinclair/typebox/value`. Extension runtime checks must use `checkSchema` in `extensions/typebox-check.ts`, which prefers a callable `schema.safeParse` and otherwise uses `Value.Check`. A foreign-family `Unknown type` throw is rethrown as `schema validation used a foreign typebox implementation (...)`. `Type.Unsafe` tool parameters still come back with no plain keys and a `safeParse` function under OMP 18.19.0; that degradation is reported, not fixed.
