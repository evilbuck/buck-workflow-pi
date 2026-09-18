# Seams: what to name before the first RED

The TDD Plan step requires naming the **seams** a change will be tested
through before writing the first failing test. This file defines what that
means and names the failure mode it prevents.

## What a seam is

See [../../codebase-design/SKILL.md](../../codebase-design/SKILL.md) for the
definition (**seam**, and the related **module / interface / adapter / depth /
leverage / locality** vocabulary). Do not restate the definitions here — that
file is the single source of truth.

## Naming the seams under test

Before the first RED, write down — in the plan, the test file header, or the
session — the answers to:

1. **Which interface** does each test cross? (The function/method/endpoint the
   test calls — the same one real callers use.)
2. **Is that interface the real call path?** A test that enters through a
   shallower path than production (single-caller harness when the bug needs
   the real chain) gives false confidence.
3. **What sits behind the seam?** Which adapters (fakes, in-memory stand-ins,
   mocks) substitute for production dependencies — and is each substituted
   dependency one the test legitimately doesn't exercise?

If you cannot name the seam for a behaviour, that is a design signal, not a
testing inconvenience: the module may be the wrong shape (see the deletion
test and "one adapter is hypothetical, two is real" in
[../../codebase-design/SKILL.md](../../codebase-design/SKILL.md)).

## The tautological-test anti-pattern

An assertion that **recomputes the expected value the same way the code under
test does** passes for any implementation, including a wrong one:

```typescript
// Tautological: mirrors the implementation's own arithmetic
expect(total).toBe(items.reduce((sum, i) => sum + i.price, 0));

// Real: the expected value comes from an independent source
expect(total).toBe(42);
```

This is **not** covered by the harness global bootstrap's anti-padding
rules (same-path parameter rows, tautologies-by-shape, bare not-throw,
non-empty checks) — those catch tests that assert nothing; this catches a
test that asserts something that cannot fail.

**Test**: could this assertion survive a subtly wrong implementation? If the
expected value would drift in lockstep with the bug, the test is tautological.
Anchor expectations to literals, fixtures, or independently computed values.
