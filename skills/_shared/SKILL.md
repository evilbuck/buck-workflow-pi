---
name: _shared
description: Shared resources and cross-skill protocols. Internal skill that re-exports content from skills/_shared/*.md so other skills can reference it via skill://_shared/<file>.md.
---

# _shared: Cross-Skill Resources

This skill exists so that other skills can reference shared resources through the
`skill://_shared/<file>.md` URL form. The body content for each resource lives in
the sibling `.md` files in this directory; load them by filename.

## Available Resources

| File | Purpose |
|---|---|
| `subject-resolution.md` | Shared protocol all `b-*` skills use to find the active subject when invoked without an explicit path. **Read this when a skill says "apply the shared subject-resolution protocol."** |
| `lifecycle-artifacts.md` | Review-gated phase state, review-pass / iterate write boundaries, fingerprint rules, and builder-vs-reviewer-vs-save ownership. **Read with phase/build/review/save work.** |

## Usage

When a skill body references `skills/_shared/<file>.md` or `../_shared/<file>.md`,
the harness resolves it to `skill://_shared/<file>.md` and loads the matching
file from this directory. Treat each file as the canonical content; this
SKILL.md is a registration shim, not a substitute.
