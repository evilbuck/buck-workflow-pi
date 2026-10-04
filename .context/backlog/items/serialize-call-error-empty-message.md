---
title: serializeCallError emits an empty message for a nameless, messageless Error
status: active
priority: low
created: 2026-10-03
updated: 2026-10-03
completed: null
related:
  - extensions/buck-loop/call-failure.ts
  - extensions/buck-loop/__tests__/call-failure.test.ts
---

# serializeCallError emits an empty message for a nameless, messageless Error

`serializeCallError()` (`extensions/buck-loop/call-failure.ts`) computes
`message: error.message || safeString(error)`. When both `name` and `message` are
empty — a subclass that overrides both to `""`, or a library error constructed
with no arguments — `String(error)` is also `""`, so the fallback yields an
empty string. The emitted blob then reads `{"name":"Error","message":""}`.

Verified 2026-10-03: a `class Silent extends Error` with `name = ""` and
`message = ""` serializes to `message: ""`.

An empty `message` is the one field an operator reads first, and `""` carries no
information about the failure — it looks like a serialization bug rather than
an error with nothing to say. `name` degrades acceptably to the literal
`"Error"`.

This surfaced while adding coverage; the case is currently untested, which is
deliberate. Do not pin `""` as the contract — a test that asserts the current
empty string would freeze an accident and make a future fix look like a
regression.

## Tests to add once the behavior is decided

- An `Error` subclass with `name: "Boom"` and `message: ""` → assert
  `message: "Boom"`. This covers the `|| safeString(error)` fallback with an
  unambiguous value and passes today.
- An `Error` with `name: ""` and a real message → assert `name: "Error"`.

Leave the both-empty case untested until the product decision is made. If the
decision is to degrade to a placeholder, the fix is a final
`|| "[unnamed error]"` on the message, and the both-empty test asserts that.
